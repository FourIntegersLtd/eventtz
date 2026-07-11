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
      setIsReady(false);
    }, [src]);

    const markReady = () => {
      setIsReady(true);
    };

    const opacityClass =
      fadeIn && src ? (isReady ? "opacity-100" : "opacity-0") : "opacity-100";

    return (
      <video
        ref={innerRef}
        src={src}
        className={`transition-opacity duration-700 ease-out ${opacityClass} ${className}`.trim()}
        onLoadedData={(event) => {
          markReady();
          onLoadedData?.(event);
        }}
        onCanPlay={(event) => {
          markReady();
          onCanPlay?.(event);
        }}
        {...rest}
      />
    );
  },
);
