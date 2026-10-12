"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Pulsing grey placeholder shown while an image / frame is still loading. */
function Skeleton({ rounded = "" }: { rounded?: string }) {
  return <span aria-hidden="true" className={`absolute inset-0 animate-pulse bg-navy-100 ${rounded}`} />;
}

interface SkeletonImageProps {
  src: string;
  alt: string;
  /** Classes for the <img> itself (size, object-fit, border, rounding…). */
  className?: string;
  /** Classes for the box around it (e.g. a fixed size for avatars). */
  wrapperClassName?: string;
  /** Extra classes on the box only while loading, so natural-size images still reserve some room. */
  loadingClassName?: string;
  /** Rounding to give the skeleton so it matches the image shape, e.g. "rounded-full". */
  skeletonRounded?: string;
  loading?: "lazy" | "eager";
}

/**
 * An image that shows a loading skeleton until it has fully loaded, then fades in — instead of
 * popping in (or showing nothing) while the file downloads. Falls back to a plain box if the
 * image fails to load.
 */
export default function SkeletonImage({
  src,
  alt,
  className = "",
  wrapperClassName = "",
  loadingClassName = "",
  skeletonRounded = "rounded-xl",
  loading,
}: SkeletonImageProps) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const ref = useRef<HTMLImageElement>(null);

  // A new src starts loading again; a cached image may already be complete before React attaches onLoad.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) setState("loaded");
    else setState("loading");
  }, [src]);

  return (
    <span className={`relative inline-block ${wrapperClassName} ${state === "loading" ? loadingClassName : ""}`}>
      {state === "loading" && <Skeleton rounded={skeletonRounded} />}
      {state === "failed" && (
        <span
          role="img"
          aria-label={alt}
          className={`absolute inset-0 flex items-center justify-center bg-navy-100 text-ink-faint text-[0.72rem] text-center p-1 ${skeletonRounded}`}
        >
          Image unavailable
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading={loading}
        onLoad={() => setState("loaded")}
        onError={() => setState("failed")}
        className={`${className} block transition-opacity duration-200 ${state === "loaded" ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}

/** Same idea for embedded files (PDFs): skeleton until the frame has loaded. */
export function SkeletonFrame({ src, title, className = "" }: { src: string; title: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [src]);
  return (
    <span className="relative block w-full">
      {!loaded && <Skeleton rounded="rounded-xl" />}
      <iframe
        src={src}
        title={title}
        onLoad={() => setLoaded(true)}
        className={`${className} block transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}

export type { ReactNode };
