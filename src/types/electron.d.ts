declare global {
  interface Window {
    electronApi?: {
      generatePdf: (html: string, fileName: string) => Promise<string>;
    };
  }
}

export {};
