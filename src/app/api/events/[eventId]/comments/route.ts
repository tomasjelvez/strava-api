import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getEventViewerAccess } from "@/lib/community-events/access";
import {
  uploadEventImageBlob,
  validateEventImageFile,
} from "@/lib/community-events/image-upload";
import { mapUserDisplayNames } from "@/lib/clerk-display";

function isValidCuid(id: unknown): id is string {
  return typeof id === "string" && id.length > 8 && /^[a-z0-9]+$/i.test(id);
}

export async function GET(
  _request: Request,
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

  const comments = await prisma.communityEventComment.findMany({
    where: { communityEventId: access.event.id },
    include: {
      images: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const names = await mapUserDisplayNames(comments.map((c) => c.authorUserId));

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      authorUserId: c.authorUserId,
      authorDisplayName: names[c.authorUserId] ?? "Miembro",
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      images: c.images.map((img) => ({
        id: img.id,
        uploaderUserId: img.uploaderUserId,
        uploaderDisplayName: names[img.uploaderUserId] ?? "Miembro",
        url: `/api/events/${encodeURIComponent(access.event.id)}/images/${encodeURIComponent(img.id)}`,
        altText: img.altText,
        createdAt: img.createdAt.toISOString(),
      })),
    })),
  });
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

  let text = "";
  let file: File | null = null;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const body = form.get("body");
    const maybeFile = form.get("file");
    text = typeof body === "string" ? body.trim().slice(0, 1000) : "";
    file = maybeFile instanceof File && maybeFile.size > 0 ? maybeFile : null;
  } else {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
    }
    const body = (raw as { body?: unknown }).body;
    text = typeof body === "string" ? body.trim().slice(0, 1000) : "";
  }

  if (text.length < 1 && !file) {
    return NextResponse.json(
      { error: "Escribí un comentario o adjuntá una imagen" },
      { status: 400 }
    );
  }

  if (file) {
    const validationError = validateEventImageFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
  }

  const blob = file ? await uploadEventImageBlob(access.event.id, file) : null;

  const { comment, image } = await prisma.$transaction(async (tx) => {
    const createdComment = await tx.communityEventComment.create({
      data: {
        communityEventId: access.event.id,
        authorUserId: userId,
        body: text,
      },
    });

    const createdImage =
      file && blob
        ? await tx.communityEventImage.create({
            data: {
              communityEventId: access.event.id,
              commentId: createdComment.id,
              uploaderUserId: userId,
              url: blob.url,
              pathname: blob.pathname,
              contentType: file.type,
              altText: text || null,
            },
          })
        : null;

    return { comment: createdComment, image: createdImage };
  });

  const names = await mapUserDisplayNames([userId]);

  return NextResponse.json({
    comment: {
      id: comment.id,
      authorUserId: comment.authorUserId,
      authorDisplayName: names[userId] ?? "Miembro",
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      images: image
        ? [
            {
              id: image.id,
              uploaderUserId: image.uploaderUserId,
              uploaderDisplayName: names[userId] ?? "Miembro",
              url: `/api/events/${encodeURIComponent(access.event.id)}/images/${encodeURIComponent(image.id)}`,
              altText: image.altText,
              createdAt: image.createdAt.toISOString(),
            },
          ]
        : [],
    },
  });
}
