import { QRCodeSVG } from "qrcode.react";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  roomName: string;
}

export default function QRCodeDisplay({
  value,
  size = 256,
  roomName,
}: QRCodeDisplayProps) {
  return (
    <div className="bg-white p-6 rounded-lg flex flex-col items-center justify-center">
      <QRCodeSVG
        value={value}
        size={size}
        level="H"
        includeMargin={true}
        fgColor="#991b1b"
      />
      <p className="text-sm text-black mt-4 font-medium">{roomName}</p>
      <p className="text-xs text-gray-600 mt-1 text-center max-w-xs break-all">
        {value}
      </p>
    </div>
  );
}
