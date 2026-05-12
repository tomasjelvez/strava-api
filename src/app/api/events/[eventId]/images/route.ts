import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getEventViewerAccess } from "@/lib/community-events/access";
import {
  uploadEventImageBlob,
  validateEventImageFile,
} from "@/lib/community-events/image-upload";

function isValidCuid(id: unknown): id is string {
  return typeof id === "string" && id.length > 8 && /^[a-z0-9]+$/i.test(id);
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ eventId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { eventId } = await ctx.params;
  if (!isValidCuid(eventId)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const access = await getEventViewerAccess(eventId, userId);
  if (!access) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (!access.canViewDetails) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const altTextRaw = form.get("altText");
  const altText =
    typeof altTextRaw === "string" ? altTextRaw.trim().slice(0, 280) : "";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Subí una imagen válida" }, { status: 400 });
  }
  const validationError = validateEventImageFile(file);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const blob = await uploadEventImageBlob(access.event.id, file);

    const image = await prisma.communityEventImage.create({
      data: {
        communityEventId: access.event.id,
        uploaderUserId: userId,
        url: blob.url,
        pathname: blob.pathname,
        contentType: file.type,
        altText: altText || null,
      },
    });

    return NextResponse.json({
      image: {
        id: image.id,
        uploaderUserId: image.uploaderUserId,
        url: `/api/events/${encodeURIComponent(access.event.id)}/images/${encodeURIComponent(image.id)}`,
        altText: image.altText,
        createdAt: image.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Vercel Blob upload failed", err);
    return NextResponse.json(
      { error: "No se pudo subir la imagen. Revisá BLOB_READ_WRITE_TOKEN." },
      { status: 500 }
    );
  }
}
