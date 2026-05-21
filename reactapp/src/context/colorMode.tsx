import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type ColorMode = 'default' | 'redGreen' | 'blueYellow' | 'monochrome';

type Ctx = { colorMode: ColorMode; setColorMode: (m: ColorMode) => void };

const ColorModeContext = createContext<Ctx>({ colorMode: 'default', setColorMode: () => {} });

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorMode] = useState<ColorMode>('default');
  return (
    <ColorModeContext.Provider value={{ colorMode, setColorMode }}>
      {children}
    </ColorModeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useColorMode = () => useContext(ColorModeContext);
