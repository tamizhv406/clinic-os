type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "size-11" }: BrandLogoProps) {
  return (
    <img
      src="/vernex-logo.png"
      alt="Vernex"
      className={`${className} shrink-0 object-contain`}
    />
  );
}
