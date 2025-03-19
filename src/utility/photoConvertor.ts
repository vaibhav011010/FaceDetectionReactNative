import * as FileSystem from "expo-file-system";

export const convertPhotoToBase64 = async (
  uri: string
): Promise<{ image_name: string; image_base64: string }> => {
  try {
    const fileUri = uri.startsWith("file://") ? uri : `file://${uri}`;
    console.log("Converting photo to base64 with URI:", fileUri);

    // Extract file name from URI
    const image_name = fileUri.split("/").pop() || "photo.jpg";

    const image_base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { image_name, image_base64 };
  } catch (error) {
    console.error("Error converting photo to base64:", error);
    throw error;
  }
};
