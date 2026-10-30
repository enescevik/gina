import { Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle } from "react-native";

export interface FieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  labelStyle?: StyleProp<TextStyle>;
}

export function Field({ label, error, labelStyle, className, ...rest }: FieldProps) {
  return (
    <View className="gap-1">
      <Text style={[{ color: "#294A48" }, labelStyle]} className="text-base font-body-bold text-ink">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#7B827A"
        style={{ fontFamily: "Nunito_400Regular", minHeight: 52, paddingVertical: 12 }}
        className={`min-h-12 rounded-parent border border-[#D7CDBB] bg-[#FFFCF6] px-3 text-lg text-ink ${className ?? ""}`}
        {...rest}
      />
      {error ? <Text className="font-body text-sm text-danger">{error}</Text> : null}
    </View>
  );
}
