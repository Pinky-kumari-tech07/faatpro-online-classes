import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HomeCarouselProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyFor: (item: T, index: number) => string;
  slideClassName?: string;
  autoPlay?: boolean;
  pauseOnHover?: boolean;
  showArrows?: boolean;
  showDots?: boolean;
  ariaLabel?: string;
  delay?: number;
}

export default function HomeCarousel<T>({
  items,
  renderItem,
  keyFor,
  slideClassName = "basis-full sm:basis-1/2 lg:basis-1/3",
  autoPlay = true,
  pauseOnHover = true,
  showArrows = true,
  showDots = true,
  ariaLabel = "Carousel",
  delay = 4500,
}: HomeCarouselProps<T>) {
  const autoplay = useRef(
    autoPlay
      ? Autoplay({ delay, stopOnInteraction: false, stopOnMouseEnter: pauseOnHover })
      : null,
  );
  const plugins = autoplay.current ? [autoplay.current] : [];
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start", slidesToScroll: 1 }, plugins);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIdx(emblaApi.selectedScrollSnap());
    setSnaps(emblaApi.scrollSnapList());
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", () => { setSnaps(emblaApi.scrollSnapList()); onSelect(); });
    onSelect();
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <div className="relative" aria-label={ariaLabel} role="region">
      <div className="flex items-center justify-end gap-2 mb-4 sm:absolute sm:-top-14 sm:right-0 sm:mb-0">
        {showArrows && (
          <>
            <Button variant="outline" size="icon" onClick={scrollPrev} aria-label="Previous slide"><ArrowLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={scrollNext} aria-label="Next slide"><ArrowRight className="h-4 w-4" /></Button>
          </>
        )}
      </div>
      <div className="overflow-hidden -mx-2 px-2 py-2" ref={emblaRef}>
        <div className="flex -ml-6">
          {items.map((item, i) => (
            <div
              key={keyFor(item, i)}
              className={`pl-6 shrink-0 grow-0 ${slideClassName}`}
            >
              {renderItem(item, i)}
            </div>
          ))}
        </div>
      </div>
      {showDots && snaps.length > 1 && (
        <div className="mt-6 flex justify-center gap-1.5">
          {snaps.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${selectedIdx === i ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-primary/40"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}