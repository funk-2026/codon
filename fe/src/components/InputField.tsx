import { useState } from 'react';
import {
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

export type InputFieldProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  helperText?: string;
  error?: string;
  multiline?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export function InputField({
  label,
  helperText,
  error,
  multiline,
  containerStyle,
  onFocus,
  onBlur,
  ...inputProps
}: InputFieldProps) {
  const { color, type, radius, space } = useTheme();
  const [focused, setFocused] = useState(false);
  const hasError = !!error;

  const borderColor = hasError
    ? color('semantic/danger')
    : focused
      ? color('accent/default')
      : color('border/subtle');
  const borderWidth = focused && !hasError ? 2 : hasError ? 2 : 1;
  const bottomText = error ?? helperText;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text
          style={[
            type['type/caption'],
            { color: color('text/secondary'), marginBottom: space['2xs'] },
          ]}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={color('text/tertiary')}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          type['type/body-l'],
          {
            color: color('text/primary'),
            backgroundColor: color('bg/sunken'),
            borderRadius: radius.sm,
            borderWidth,
            borderColor,
            paddingHorizontal: space.sm,
            paddingVertical: space.sm,
            minHeight: multiline ? 96 : 48,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
      {bottomText ? (
        <Text
          style={[
            type['type/caption'],
            {
              color: hasError ? color('semantic/danger') : color('text/tertiary'),
              marginTop: space['2xs'],
            },
          ]}
        >
          {bottomText}
        </Text>
      ) : null}
    </View>
  );
}
