import { useEffect, useRef, useState } from "react";

export function useComposition(onChange?: (value: string) => void) {
  const [isComposing, setIsComposing] = useState(false);
  const valueRef = useRef("");

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    valueRef.current = e.currentTarget.value;
    onChange?.(e.currentTarget.value);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    valueRef.current = e.currentTarget.value;
    if (!isComposing) {
      onChange?.(e.currentTarget.value);
    }
  };

  return {
    isComposing,
    handleCompositionStart,
    handleCompositionEnd,
    handleChange,
  };
}
