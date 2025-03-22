// processAndStoreImage.ts
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";

/**
 * Processes an image by resizing and compressing it, then moves it
 * to a persistent 'photos' folder. Returns the new file URI.
 *
 * @param uri - The original image URI.
 * @param targetWidth - Desired width in pixels (default 800).
 * @param compress - Compression quality between 0 and 1 (default 0.7).
 * @returns The new persistent file URI.
 */
export const processAndStoreImage = async (
  uri: string,
  targetWidth: number = 800,
  compress: number = 0.7
): Promise<string> => {
  // Ensure the URI starts with "file://"
  const fileUri = uri.startsWith("file://") ? uri : `file://${uri}`;

  // Resize and compress the image using expo-image-manipulator
  const manipulatedResult = await ImageManipulator.manipulateAsync(
    fileUri,
    [{ resize: { width: targetWidth } }],
    { compress, format: ImageManipulator.SaveFormat.JPEG }
  );

  // Define a persistent directory (e.g., "photos" in the document directory)
  const photosDir = FileSystem.documentDirectory + "photos/";
  const dirInfo = await FileSystem.getInfoAsync(photosDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
  }

  // Generate a unique file name. Here we use the original file name if available.
  const fileName = manipulatedResult.uri.split("/").pop() || "photo.jpg";
  const newPath = photosDir + fileName;

  // Move the manipulated image from cache to the persistent directory
  await FileSystem.moveAsync({
    from: manipulatedResult.uri,
    to: newPath,
  });

  console.log("Image saved to:", newPath);
  return newPath;
};
