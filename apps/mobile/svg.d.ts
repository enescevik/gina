// react-native-svg-transformer: .svg içe aktarımı React bileşeni döndürür.
declare module "*.svg" {
  import type { FC } from "react";
  import type { SvgProps } from "react-native-svg";
  const content: FC<SvgProps>;
  export default content;
}
