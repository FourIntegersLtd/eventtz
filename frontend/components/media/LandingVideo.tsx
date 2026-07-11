"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type VideoHTMLAttributes,
} from "react";

type LandingVideoProps = Omit<
  VideoHTMLAttributes<HTMLVideoElement>,
  "src" | "className"
> & {
  src?: string;
  className?: string;
  /** Fade in once the first frame is ready to play. */
  fadeIn?: boolean;
};

export const LandingVideo = forwardRef<HTMLVideoElement, LandingVideoProps>(
  function LandingVideo(
    { src, className = "", fadeIn = true, onCanPlay, onLoadedData, ...rest },
    ref,
  ) {
    const innerRef = useRef<HTMLVideoElement>(null);
    const [isReady, setIsReady] = useState(false);

    useImperativeHandle(ref, () => innerRef.current as HTMLVideoElement);

    useEffect(() => {
      if (!fadeIn || !src) {
        setIsReady(true);
        return;
      }

      setIsReady(false);
      const el = innerRef.current;
      if (!el) return;

      const markReady = () => {
        if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
          setIsReady(true);
        }
      };

      markReady();

      const events = ["loadedmetadata", "loadeddata", "canplay", "playing"] as const;
      for (const event of events) {
        el.addEventListener(event, markReady);
      }

      // Mobile Safari can miss the first readiness event on cold load.
      const fallback = window.setTimeout(markReady, 1500);

      return () => {
        window.clearTimeout(fallback);
        for (const event of events) {
          el.removeEventListener(event, markReady);
        }
      };
    }, [fadeIn, src]);

    const handleLoadedData = (event: React.SyntheticEvent<HTMLVideoElement>) => {
      setIsReady(true);
      onLoadedData?.(event);
    };

    const handleCanPlay = (event: React.SyntheticEvent<HTMLVideoElement>) => {
      setIsReady(true);
      onCanPlay?.(event);
    };

    const opacityClass =
      fadeIn && src ? (isReady ? "opacity-100" : "opacity-0") : "opacity-100";

    return (
      <video
        ref={innerRef}
        src={src}
        className={`transition-opacity duration-700 ease-out ${opacityClass} ${className}`.trim()}
        {...rest}
        onLoadedData={handleLoadedData}
        onCanPlay={handleCanPlay}
      />
    );
  },
);
