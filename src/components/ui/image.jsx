import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

/**
 * Lightweight Image component (no external image-kit dependency).
 * - Props: src, alt, className, width, height, layout, objectFit, placeholder (url), lazy (bool)
 * - Exposes a `load` method via ref (if caller needs it).
 *
 * Example:
 * <Image src="/img/foo.jpg" alt="Foo" width={800} height={600} placeholder="/img/foo-blur.jpg" />
 */

const Image = forwardRef(function Image(
  {
    src,
    alt = "",
    className = "",
    width,
    height,
    style,
    placeholder,
    lazy = true,
    objectFit = "cover",
    onLoad,
    ...rest
  },
  ref
) {
  const imgRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(!!placeholder);

  // expose a `load` method if parent wants to trigger load
  useImperativeHandle(ref, () => ({
    load: () => {
      if (imgRef.current && imgRef.current.src !== src) {
        imgRef.current.src = src;
      }
    },
  }));

  useEffect(() => {
    // if src changes, reset state so placeholder shows until the new image loads
    setIsLoaded(false);
    setShowPlaceholder(!!placeholder);
  }, [src, placeholder]);

  return (
    <div
      className={`relative overflow-hidden inline-block ${className}`}
      style={{
        width: width ? (typeof width === "number" ? `${width}px` : width) : undefined,
        height: height ? (typeof height === "number" ? `${height}px` : height) : undefined,
        ...style,
      }}
    >
      {/* placeholder (blur or small image) */}
      {showPlaceholder && (
        <img
          src={placeholder}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover blur-sm scale-105 transition-opacity"
          style={{
            opacity: isLoaded ? 0 : 1,
            objectFit,
          }}
        />
      )}

      {/* real image */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={lazy ? "lazy" : "eager"}
        onLoad={(e) => {
          setIsLoaded(true);
          // hide placeholder after short delay for smoother transition
          setTimeout(() => setShowPlaceholder(false), 80);
          onLoad && onLoad(e);
        }}
        style={{
          width: "100%",
          height: "100%",
          objectFit,
          display: "block",
          transition: "opacity 200ms ease-in-out, transform 200ms ease-in-out",
          opacity: isLoaded ? 1 : 0,
        }}
        {...rest}
      />
    </div>
  );
});

export { Image };
export default Image;
