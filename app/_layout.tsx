import { Slot } from "expo-router";
import { LoginProvider } from "./context/LoginContext";

export default function Layout() {
  return (
    <>
      {/* Any shared components can go here, like a header or footer */}
      <LoginProvider>
        <Slot />
      </LoginProvider>
      {/* If you want to include a footer or common navigation for main */}
      {/* <Footer /> */}
    </>
  );
}
