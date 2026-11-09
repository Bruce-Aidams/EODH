/**
 * PDF Reader component — platform-specific implementation.
 *
 * On web: shows a fallback message (react-native-pdf-jsi is native-only).
 * On native: renders PDFs using react-native-pdf-jsi.
 *
 * Metro automatically resolves .web.tsx for web and .native.tsx for native platforms.
 */
export { default, PdfReaderProps } from './PdfReader.native';
