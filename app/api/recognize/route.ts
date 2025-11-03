import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    const language = formData.get("language") as string;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Upload audio to S3 first
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const key = `audio-temp/${Date.now()}-${Math.random().toString(36).substring(7)}.webm`;
    
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: audioFile.type,
    });

    await s3Client.send(uploadCommand);

    // Generate public URL
    const audioUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;

    // Call Verbum batch API
    const batchResponse = await fetch(
      "https://sdk.verbum.ai/v1/scribe/batch",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.VERBUM_API_KEY!,
        },
        body: JSON.stringify({
          urls: [audioUrl],
          language: language || "en-US",
        }),
      }
    );

    if (!batchResponse.ok) {
      const errorText = await batchResponse.text();
      console.error("Verbum batch API error:", errorText);
      return NextResponse.json(
        { error: "Speech recognition failed", details: errorText },
        { status: batchResponse.status }
      );
    }

    const batchData = await batchResponse.json();
    const jobId = batchData.id;

    // Poll for results (max 30 seconds)
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const statusResponse = await fetch(
        `https://sdk.verbum.ai/v1/scribe/batch/${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.VERBUM_API_KEY}`,
          },
        }
      );

      if (!statusResponse.ok) {
        console.error("Failed to check job status");
        attempts++;
        continue;
      }

      const statusData = await statusResponse.json();
      
      if (statusData.status === "completed") {
        // Get the transcription results
        const resultsResponse = await fetch(
          `https://sdk.verbum.ai/v1/scribe/batch/${jobId}/results`,
          {
            headers: {
              Authorization: `Bearer ${process.env.VERBUM_API_KEY}`,
            },
          }
        );

        if (!resultsResponse.ok) {
          return NextResponse.json(
            { error: "Failed to get transcription results" },
            { status: 500 }
          );
        }

        const results = await resultsResponse.json();
        return NextResponse.json({ text: results.transcripts[0]?.text || "" });
      } else if (statusData.status === "failed") {
        return NextResponse.json(
          { error: "Transcription job failed" },
          { status: 500 }
        );
      }

      attempts++;
    }

    return NextResponse.json(
      { error: "Transcription timeout" },
      { status: 408 }
    );
  } catch (error) {
    console.error("STT API error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
