import { useState } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { useTranslation } from 'react-i18next';

// The original approved board is kept intact. Only this illustration rectangle is
// visible; all reference UI, labels and device frames remain outside the viewport.
const source = require('../../../../../packages/assets/rooms/mint-home/layered-v1/approved-original.png');
const crop = { x: 46, y: 193, width: 729, height: 641 };

export function ApprovedScene({ style, onTasks, onProva, onCollection }: {
  style: StyleProp<ViewStyle>; onTasks?: () => void; onProva?: () => void; onCollection?: () => void;
}) {
  const { t } = useTranslation();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const scale = Math.max(box.width / crop.width, box.height / crop.height);
  const left = (box.width - crop.width * scale) / 2;
  // Keep the mascot and its book in frame, including on short landscape phones.
  const top = box.height - crop.height * scale;
  return <View testID="mint-room-scene" style={[{ overflow: 'hidden', backgroundColor: '#DCC1B2' }, style]} onLayout={e => setBox(e.nativeEvent.layout)}>
    {box.width > 0 && <>
      <Image accessible={false} pointerEvents="none" source={source} resizeMode="stretch" style={{ position: 'absolute', width: 1536 * scale, height: 1024 * scale, left: left - crop.x * scale, top: top - crop.y * scale }} />
      {([
        { key: 'tasks', label: t('childMint.tasks'), x: .08, y: .55, w: .24, h: .16, run: onTasks },
        { key: 'prova', label: t('prova.title'), x: .61, y: .25, w: .17, h: .46, run: onProva },
        { key: 'collection', label: t('room.myCollection'), x: .79, y: .27, w: .20, h: .20, run: onCollection },
      ]).filter(a => a.run).map(a => <Pressable key={a.key} accessibilityRole="button" accessibilityLabel={a.label} onPress={a.run} style={({ pressed }) => ({ position: 'absolute', left: left + a.x * crop.width * scale, top: top + a.y * crop.height * scale, width: Math.max(48, a.w * crop.width * scale), height: Math.max(48, a.h * crop.height * scale), borderRadius: 16, backgroundColor: pressed ? '#FFFFFF20' : 'transparent' })} />)}
    </>}
  </View>;
}
