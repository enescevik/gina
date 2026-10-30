import { Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle } from "react-native";

export interface FieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  labelStyle?: StyleProp<TextStyle>;
}

export function Field({ label, error, labelStyle, className, ...rest }: FieldProps) {
  return (
    <View className="gap-1">
      <Text style={labelStyle} className="text-sm font-medium text-ink dark:text-night-text">{label}</Text>
      <TextInput
        placeholderTextColor="#9CA3AF"
        className={`min-h-12 rounded-parent border border-mist bg-white px-3 text-base text-ink dark:border-night-surface dark:bg-night-surface dark:text-night-text ${className ?? ""}`}
        {...rest}
      />
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}
    </View>
  );
}
