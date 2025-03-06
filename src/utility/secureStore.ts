import * as SecureStore from "expo-secure-store";

export async function saveLoginState(isLoggedIn: boolean) {
  await SecureStore.setItemAsync("isLoggedIn", JSON.stringify(isLoggedIn));
}

export async function getLoginState(): Promise<boolean> {
  const result = await SecureStore.getItemAsync("isLoggedIn");
  return result === "true";
}
