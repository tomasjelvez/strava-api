import { get } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getEventViewerAccess } from "@/lib/community-events/access";

function isValidCuid(id: unknown): id is string {
  return typeof id === "string" && id.length > 8 && /^[a-z0-9]+$/i.test(id);
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ eventId: string; imageId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("No autorizado", { status: 401 });
  }

  const { eventId, imageId } = await ctx.params;
  if (!isValidCuid(eventId) || !isValidCuid(imageId)) {
    return new Response("No encontrado", { status: 404 });
  }

  const access = await getEventViewerAccess(eventId, userId);
  if (!access) {
    return new Response("No encontrado", { status: 404 });
  }
  if (!access.canViewDetails) {
    return new Response("No autorizado", { status: 403 });
  }

  const image = await prisma.communityEventImage.findFirst({
    where: {
      id: imageId,
      communityEventId: eventId,
    },
    select: {
      pathname: true,
      url: true,
      contentType: true,
    },
  });
  if (!image) {
    return new Response("No encontrado", { status: 404 });
  }

  const blob = await get(image.pathname ?? image.url, {
    access: "private",
    ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
  });
  if (!blob) {
    return new Response("No encontrado", { status: 404 });
  }
  if (blob.statusCode === 304) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: blob.blob.etag,
      },
    });
  }

  return new Response(blob.stream, {
    headers: {
      "Content-Type": blob.blob.contentType ?? image.contentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=60",
      ETag: blob.blob.etag,
    },
  });
}
