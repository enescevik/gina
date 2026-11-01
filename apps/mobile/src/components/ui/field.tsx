import { useState } from "react";
import { Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle } from "react-native";

export interface FieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  labelStyle?: StyleProp<TextStyle>;
  hint?: string;
}

export function Field({ label, error, labelStyle, className, hint, style, onFocus, onBlur, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{gap:8}}>
      <Text style={[{ color: "#201951" }, labelStyle]} className="text-base font-body-bold text-ink">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#77718D"
        style={[{ fontFamily: "Nunito_600SemiBold", minHeight: 54, paddingVertical: 13, paddingHorizontal:16, borderRadius:17, borderWidth:1.5, borderColor:error ? "#A43135" : focused ? "#6042DE" : "#DDD6E8", backgroundColor:rest.editable === false ? "#F2EFF6" : "#FFFFFF", color:"#201951", fontSize:17 }, style]}
        className={`min-h-12 rounded-parent border border-[#D9D3E6] bg-[#FFFFFF] px-3 text-lg text-ink ${className ?? ""}`}
        {...rest}
        onFocus={event => {setFocused(true); onFocus?.(event);}}
        onBlur={event => {setFocused(false); onBlur?.(event);}}
        accessibilityHint={rest.accessibilityHint ?? hint}
      />
      {hint ? <Text style={{fontFamily:"Nunito_400Regular",fontSize:15,lineHeight:22,color:"#625C85"}}>{hint}</Text> : null}
      {error ? <Text accessibilityRole="alert" className="font-body text-sm text-danger">{error}</Text> : null}
    </View>
  );
}
