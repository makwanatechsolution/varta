import QRCode from "qrcode";

export interface QROptions {
  size?: number;
  fgColor?: string;
  bgColor?: string;
  margin?: number;
}

export async function generateQRCodeSVG(
  text: string,
  options: QROptions = {}
): Promise<string> {
  const { size = 256, fgColor = "#111b21", bgColor = "#ffffff", margin = 2 } = options;

  return QRCode.toString(text, {
    type: "svg",
    width: size,
    margin,
    color: {
      dark: fgColor,
      light: bgColor,
    },
  });
}
