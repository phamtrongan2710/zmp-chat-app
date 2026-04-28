import { useState } from "react";

type AvatarProps = {
  url: string | null | undefined;
  label: string;
  className?: string;
};

export function Avatar({ url, label, className }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(url) && !errored;

  return (
    <div className={className ?? "avatar"}>
      {showImage ? (
        <img
          src={url ?? ""}
          alt={label}
          onError={() => setErrored(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
}
