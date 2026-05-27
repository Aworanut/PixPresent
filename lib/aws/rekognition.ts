import "server-only";
import {
  RekognitionClient,
  DeleteCollectionCommand,
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
