import { z } from 'zod';

export const memberPhoneMessage = 'Enter exactly 10 digits, without spaces or a country code.';

// Keep phone numbers as strings: leading zeros are significant. Do not trim or
// normalize historical values or accept JavaScript's trailing-newline match.
export const memberPhoneSchema = z.string({
  required_error: memberPhoneMessage,
  invalid_type_error: memberPhoneMessage,
}).length(10, memberPhoneMessage).refine(value => !/[^0-9]/.test(value), memberPhoneMessage);
