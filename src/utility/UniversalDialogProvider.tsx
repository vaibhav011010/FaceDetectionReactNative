// UniversalDialogProvider.tsx
import React, { createContext, useContext, useState, ReactNode } from "react";
import { Portal, Dialog, Paragraph, Button } from "react-native-paper";

type DialogAction = {
  label: string;
  onPress?: () => void;
  mode?: "text" | "contained";
  textColor?: string;
  buttonColor?: string;
};

type DialogOptions = {
  title?: string;
  message?: string;
  actions?: DialogAction[];
};

type DialogContextType = {
  showDialog: (options: DialogOptions) => Promise<void>;
};

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const useUniversalDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error(
      "useUniversalDialog must be used within UniversalDialogProvider"
    );
  }
  return ctx.showDialog;
};

export function UniversalDialogProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<DialogOptions>({});
  const [resolver, setResolver] = useState<() => void>(() => {});

  const showDialog = (opts: DialogOptions) => {
    return new Promise<void>((resolve) => {
      setOptions(opts);
      setResolver(() => resolve);
      setVisible(true);
    });
  };

  const closeDialog = (callback?: () => void) => {
    setVisible(false);
    resolver();
    if (callback) callback();
  };

  return (
    <DialogContext.Provider value={{ showDialog }}>
      {children}
      <Portal>
        <Dialog
          visible={visible}
          onDismiss={() => closeDialog()}
          style={{ backgroundColor: "#EEF2F6" }}
        >
          {options.title && (
            <Dialog.Title
              style={{
                color: "#03045E",
                fontFamily: "OpenSans_Condensed-Bold",
              }}
            >
              {options.title}
            </Dialog.Title>
          )}
          {options.message && (
            <Dialog.Content>
              <Paragraph
                style={{
                  color: "#03045E",
                  fontFamily: "OpenSans_Condensed-SemiBold",
                }}
              >
                {options.message}
              </Paragraph>
            </Dialog.Content>
          )}
          <Dialog.Actions>
            {options.actions?.map((action, index) => (
              <Button
                key={index}
                mode="text"
                textColor={action.textColor || "#03045E"}
                // buttonColor={
                //   action.buttonColor ||
                //   (action.mode === "contained" ? "#03045E" : undefined)
                // }
                onPress={() => closeDialog(action.onPress)}
              >
                {action.label}
              </Button>
            ))}
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </DialogContext.Provider>
  );
}
