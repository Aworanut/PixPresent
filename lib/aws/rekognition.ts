import "server-only";
import {
  RekognitionClient,
  DeleteCollectionCommand,
  SearchFacesCommand,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";

let cachedClient: RekognitionClient | null = null;

function getClient(): RekognitionClient | null {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = new RekognitionClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return cachedClient;
}

export async function searchFacesBySimilarFaceId(
  faceId: string,
  collectionId: string,
  threshold = 80,
): Promise<string[]> {
  const client = getClient();
  if (!client) {
    console.warn("[rekognition] AWS creds missing — returning stub empty results");
    return [];
  }
  try {
    const result = await client.send(
      new SearchFacesCommand({
        CollectionId: collectionId,
        FaceId: faceId,
        MaxFaces: 500,
        FaceMatchThreshold: threshold,
      }),
    );
    return (result.FaceMatches ?? [])
      .map((m) => m.Face?.FaceId)
      .filter(Boolean) as string[];
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.name === "ResourceNotFoundException" ||
        err.name === "InvalidParameterException")
    )
      return [];
    throw err;
  }
}

/**
 * Search a collection for faces matching the given image bytes. Used by the
 * person-archive matching engine to find a named person's photos in an event.
 * Returns matched FaceIds with their similarity scores. Empty on stub / no match.
 */
export async function searchFacesByImage(
  imageBytes: Uint8Array,
  collectionId: string,
  threshold = 80,
): Promise<Array<{ faceId: string; similarity: number }>> {
  const client = getClient();
  if (!client) {
    console.warn("[rekognition] AWS creds missing — returning stub empty results");
    return [];
  }
  try {
    const result = await client.send(
      new SearchFacesByImageCommand({
        CollectionId: collectionId,
        Image: { Bytes: imageBytes },
        MaxFaces: 500,
        FaceMatchThreshold: threshold,
      }),
    );
    return (result.FaceMatches ?? [])
      .filter((m) => m.Face?.FaceId != null)
      .map((m) => ({ faceId: m.Face!.FaceId!, similarity: m.Similarity ?? 0 }));
  } catch (err: unknown) {
    // No face in the reference image, empty collection, or bad image → no matches.
    if (
      err instanceof Error &&
      (err.name === "ResourceNotFoundException" ||
        err.name === "InvalidParameterException" ||
        err.name === "InvalidImageFormatException")
    )
      return [];
    throw err;
  }
}

export async function deleteRekognitionCollection(
  collectionId: string | null,
): Promise<{ ok: boolean; skipped?: string }> {
  if (!collectionId) return { ok: true, skipped: "no collection id" };

  const client = getClient();
  if (!client) {
    console.warn(
      `[rekognition] skipping DeleteCollection(${collectionId}) — AWS creds not configured`,
    );
    return { ok: true, skipped: "aws creds missing" };
  }

  try {
    await client.send(new DeleteCollectionCommand({ CollectionId: collectionId }));
    return { ok: true };
  } catch (err: unknown) {
    // Idempotent: collection already gone is a successful outcome
    if (
      err instanceof Error &&
      err.name === "ResourceNotFoundException"
    ) {
      return { ok: true, skipped: "collection already deleted" };
    }
    console.error(
      `[rekognition] DeleteCollection failed for ${collectionId}:`,
      err,
    );
    return { ok: false };
  }
}
