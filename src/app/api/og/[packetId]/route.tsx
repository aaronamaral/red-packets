import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "edge";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ packetId: string }> }
) {
  const { packetId: uuid } = await params;

  let creatorHandle = "";
  let creatorAvatar = "";
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT creator_twitter_handle, creator_twitter_avatar
      FROM packets WHERE id = ${uuid} LIMIT 1
    `;
    if (rows.length > 0) {
      creatorHandle = rows[0].creator_twitter_handle || "";
      creatorAvatar = rows[0].creator_twitter_avatar || "";
    }
  } catch {
    // Fall back to defaults
  }

  const avatarUrl = creatorAvatar
    ? creatorAvatar.replace("_normal", "_400x400")
    : "";

  const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
  const templateUrl = `${baseUrl}/images/card-template.png`;

  // PFP circle position (measured from 1200x675 template)
  // Circle center: ~740px from left, ~280px from top
  // Circle diameter: ~230px
  const pfpSize = 310;
  const pfpX = 772 - pfpSize / 2;
  const pfpY = 338 - pfpSize / 2;

  const handleX = 277;
  const handleY = 365;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
        }}
      >
        {/* Template background */}
        <img
          src={templateUrl}
          width={1200}
          height={675}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        />

        {/* PFP overlay */}
        {avatarUrl && (
          <img
            src={avatarUrl}
            width={pfpSize}
            height={pfpSize}
            style={{
              position: "absolute",
              left: pfpX,
              top: pfpY,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        )}

        {/* Handle text after the @ */}
        {creatorHandle && (
          <span
            style={{
              position: "absolute",
              left: handleX,
              top: handleY,
              fontSize: 36,
              color: "white",
              fontFamily: "sans-serif",
              opacity: 1,
            }}
          >
            {creatorHandle}
          </span>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 675,
    }
  );
}
