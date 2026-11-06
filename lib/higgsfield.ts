import { need } from "@/lib/server";

export const HF_HOST = "https://api.higgsfield.ai";
export const HF_MODEL = process.env.HIGGSFIELD_VIDEO_MODEL || "wan/v2.7/image-to-video";

export function hfHeaders(): Record<string, string> {
  return {
    Authorization: `Key ${need("HIGGSFIELD_API_KEY")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}
