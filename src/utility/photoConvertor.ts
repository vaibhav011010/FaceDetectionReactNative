// imageConversion.ts
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";

// Create an ExtendedFileInfo type by intersecting FileSystem.FileInfo with an optional size property.
type ExtendedFileInfo = FileSystem.FileInfo & { size?: number };

/**
 * Reduces the image size by resizing it to the target width while maintaining the aspect ratio.
 * It returns the new image URI, dimensions, and file size.
 * @param uri - The original image URI.
 * @param targetWidth - The desired width in pixels (default 800).
 * @param compress - Compression quality between 0 and 1 (default 0.7).
 */
export const reduceImageSize = async (
  uri: string,
  targetWidth: number = 800,
  compress: number = 0.7
): Promise<{ uri: string; width: number; height: number; size: number }> => {
  try {
    // Resize and compress the image
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: targetWidth } }],
      { compress, format: ImageManipulator.SaveFormat.JPEG }
    );
    // Get file info (cast to ExtendedFileInfo)
    const fileInfo = (await FileSystem.getInfoAsync(
      result.uri
    )) as ExtendedFileInfo;
    const fileSize = fileInfo.size ?? 0;
    console.log(
      `Resized image: ${result.width} x ${result.height}, file size: ${fileSize} bytes`
    );
    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      size: fileSize,
    };
  } catch (error) {
    console.error("Error reducing image size:", error);
    throw error;
  }
};

/**
 * Converts the image at a given URI to a Base64 string after resizing it.
 * It logs the resized image’s dimensions and file size so you can check the quality.
 * @param uri - The original image URI.
 */
export const convertPhotoToBase64 = async (
  uri: string
): Promise<{ image_name: string; image_base64: string }> => {
  try {
    // Ensure the URI starts with "file://"
    const fileUri = uri.startsWith("file://") ? uri : `file://${uri}`;
    console.log("Original photo URI:", fileUri);

    // Reduce the image size before conversion
    const reduced = await reduceImageSize(fileUri, 800, 0.7);
    console.log(
      "Reduced photo URI:",
      reduced.uri,
      "Dimensions:",
      reduced.width,
      "x",
      reduced.height,
      "Size:",
      reduced.size,
      "bytes"
    );

    // Extract the file name from the URI
    const image_name = reduced.uri.split("/").pop() || "photo.jpg";

    // Read the reduced image file as a Base64 string
    const image_base64 = await FileSystem.readAsStringAsync(reduced.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return { image_name, image_base64 };
  } catch (error) {
    console.error("Error converting photo to base64:", error);
    throw error;
  }
};
