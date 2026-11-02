import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import i18n from "./i18n";
import { supabase } from "./supabase";

export interface LocalLearningFile {
  id: string;
  name: string;
  mime: "image/jpeg" | "image/png" | "application/pdf";
  uri: string;
  bytes: ArrayBuffer;
  sha256: string;
  width?: number;
  height?: number;
}
async function bytesOf(uri: string, webFile?: Blob): Promise<ArrayBuffer> {
  if (Platform.OS === "web") {
    return webFile ? webFile.arrayBuffer() : (await fetch(uri)).arrayBuffer();
  }
  return new File(uri).arrayBuffer();
}
async function packed(
  name: string,
  mime: LocalLearningFile["mime"],
  uri: string,
  bytes: ArrayBuffer,
  dimensions?: { width: number; height: number },
): Promise<LocalLearningFile> {
  if (bytes.byteLength > (mime === "application/pdf" ? 10 : 4) * 1024 * 1024) {
    throw new Error("source_size_or_type");
  }
  const hash = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return {
    id: Crypto.randomUUID(),
    name: name.slice(0, 160),
    mime,
    uri,
    bytes,
    sha256: Array.from(
      new Uint8Array(hash),
      (x) => x.toString(16).padStart(2, "0"),
    ).join(""),
    ...dimensions,
  };
}
/** A local processing copy strips photo metadata; nothing is uploaded by selection. */
export async function prepareLearningImage(
  uri: string,
  name = "question.png",
  png = true,
): Promise<LocalLearningFile> {
  const context = ImageManipulator.manipulate(uri);
  let image = await context.renderAsync();
  if (Math.max(image.width, image.height) > 1600) {
    const scale = 1600 / Math.max(image.width, image.height);
    context.resize({
      width: Math.round(image.width * scale),
      height: Math.round(image.height * scale),
    });
    image = await context.renderAsync();
  }
  const rendered = await image.saveAsync({
    format: png ? SaveFormat.PNG : SaveFormat.JPEG,
    compress: 0.9,
  });
  return packed(
    name,
    png ? "image/png" : "image/jpeg",
    rendered.uri,
    await bytesOf(rendered.uri),
    { width: rendered.width, height: rendered.height },
  );
}
export async function chooseLearningPhoto(): Promise<LocalLearningFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    allowsEditing: true,
    exif: false,
    quality: 1,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return prepareLearningImage(
    asset.uri,
    asset.fileName ?? "question.jpg",
    asset.mimeType === "image/png",
  );
}
export async function chooseLearningDocument(): Promise<
  LocalLearningFile | null
> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["image/jpeg", "image/png", "application/pdf"],
    copyToCacheDirectory: true,
    multiple: false,
    base64: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.mimeType === "image/png" || asset.mimeType === "image/jpeg") {
    return prepareLearningImage(
      asset.uri,
      asset.name,
      asset.mimeType === "image/png",
    );
  }
  if (asset.mimeType !== "application/pdf") {
    throw new Error("source_size_or_type");
  }
  if (asset.size && asset.size > 10 * 1024 * 1024) {
    throw new Error("source_size_or_type");
  }
  return packed(
    asset.name,
    "application/pdf",
    asset.uri,
    await bytesOf(asset.uri, asset.file),
  );
}
export class LearningSourceError extends Error {
  constructor(public code: string) {
    super(
      i18n.t(
        code === "source_unavailable"
          ? "sources.unavailable"
          : "sources.sourceFailed",
      ),
    );
  }
}
export async function sourceAction<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("learning-source", {
    body,
  });
  if (error) {
    let code = "source_failed";
    if (error.context instanceof Response) {
      try {
        code = (await error.context.json()).error ?? code;
      } catch {}
    }
    throw new LearningSourceError(code);
  }
  if (data?.error) throw new LearningSourceError(data.error);
  return data as T;
}
/** Called only by an explicit storage-confirmation action, never after picking. */
export async function uploadLearningFile(
  file: LocalLearningFile,
  kind: "document" | "question_image",
) {
  const reserved = await sourceAction<
    { id: string; ready?: boolean; bucket: string; path: string; token: string }
  >({
    action: "reserve",
    id: file.id,
    kind,
    name: file.name,
    mime: file.mime,
    bytes: file.bytes.byteLength,
    sha256: file.sha256,
    consent: true,
  });
  if (!reserved.ready) {
    // A lost upload response can mean the immutable object already exists. Finalize
    // checks its exact hash; it never silently overwrites bytes with a second upload.
    const uploaded = await supabase.storage.from(reserved.bucket)
      .uploadToSignedUrl(reserved.path, reserved.token, file.bytes, {
        contentType: file.mime,
      });
    try {
      await sourceAction({ action: "finalize", id: file.id });
    } catch (error) {
      if (
        uploaded.error && error instanceof LearningSourceError &&
        error.code === "source_upload_incomplete"
      ) throw new LearningSourceError("source_upload_failed");
      throw error;
    }
  }
  return file.id;
}
