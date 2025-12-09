import type { Schema } from "@schema-ts/core";

export const userProfileSchema: Schema = {
  type: "object",
  title: "User Profile",
  required: ["firstName", "lastName", "contactMethod"],
  properties: {
    // === Basic String Fields ===
    firstName: { type: "string", title: "First Name", minLength: 2 },
    lastName: { type: "string", title: "Last Name", minLength: 2 },

    // === Number Field ===
    age: { type: "number", title: "Age", minimum: 18, maximum: 120 },

    // === Boolean Field ===
    isStudent: { type: "boolean", title: "Is Student" },

    // === Enum with 2 options (typically rendered as radio/toggle) ===
    gender: {
      type: "string",
      title: "Gender",
      enum: ["Male", "Female"],
    },

    // === Enum with 3+ options (typically rendered as select/dropdown) ===
    hobby: {
      type: "string",
      title: "Hobby",
      enum: ["Reading", "Gaming", "Coding", "Sports", "Music", "Travel"],
    },

    // === Enum with numeric values ===
    experienceLevel: {
      type: "integer",
      title: "Experience Level",
      enum: [1, 2, 3, 4, 5],
    },

    // === Different String Formats ===
    email: {
      type: "string",
      title: "Email Address",
      format: "email",
    },
    website: {
      type: "string",
      title: "Personal Website",
      format: "uri",
    },
    birthDate: {
      type: "string",
      title: "Birth Date",
      format: "date",
    },
    lastLogin: {
      type: "string",
      title: "Last Login",
      format: "date-time",
    },
    preferredTime: {
      type: "string",
      title: "Preferred Contact Time",
      format: "time",
    },
    userId: {
      type: "string",
      title: "User ID",
      format: "uuid",
    },
    serverHost: {
      type: "string",
      title: "Server Hostname",
      format: "hostname",
    },
    ipv4Address: {
      type: "string",
      title: "IPv4 Address",
      format: "ipv4",
    },
    ipv6Address: {
      type: "string",
      title: "IPv6 Address",
      format: "ipv6",
    },
    pattern: {
      type: "string",
      title: "Search Pattern",
      format: "regex",
    },

    // === if-then-else: Contact Method determines required fields ===
    contactMethod: {
      type: "string",
      title: "Preferred Contact Method",
      enum: ["email", "phone", "mail"],
    },

    // === Array Field ===
    emails: {
      type: "array",
      title: "Additional Emails",
      items: { type: "string", format: "email" },
    },

    // === Nested Object ===
    address: {
      type: "object",
      title: "Address",
      properties: {
        street: { type: "string", title: "Street" },
        city: { type: "string", title: "City" },
        zipCode: { type: "string", title: "Zip Code", pattern: "^[0-9]{5}$" },
        country: {
          type: "string",
          title: "Country",
          enum: ["USA", "Canada", "UK", "Germany", "France", "Japan", "China"],
        },
      },
      required: ["city", "country"],
    },
    // === X-Enum Extension Field (Example of custom metadata) ===
    status: {
      type: "string",
      title: "Account Status",
      "x-enum": [
        { name: "Active", value: "active" },
        { name: "Pending", value: "pending" },
        { name: "Suspended", value: "suspended" },
      ],
    },
  },

  // === if-then-else conditional logic ===
  if: {
    properties: {
      contactMethod: { const: "phone" },
    },
  },
  then: {
    properties: {
      phoneNumber: {
        type: "string",
        title: "Phone Number",
        pattern: "^\\+?[0-9]{10,15}$",
      },
    },
    required: ["phoneNumber"],
  },
  else: {
    if: {
      properties: {
        contactMethod: { const: "mail" },
      },
    },
    then: {
      properties: {
        mailingAddress: {
          type: "string",
          title: "Mailing Address",
          minLength: 10,
        },
      },
      required: ["mailingAddress"],
    },
  },
};

export const userProfileValue = {
  // Basic fields
  firstName: "John",
  lastName: "Doe",
  age: 28,
  isStudent: false,

  // Enum with 2 options
  gender: "Male",

  // Enum with multiple options
  hobby: "Coding",

  // Numeric enum
  experienceLevel: 3,

  // Different string formats
  email: "john.doe@example.com",
  website: "https://johndoe.dev",
  birthDate: "1995-06-15",
  lastLogin: "2025-12-23T08:30:00Z",
  preferredTime: "09:00:00",
  userId: "550e8400-e29b-41d4-a716-446655440000",
  serverHost: "api.example.com",
  ipv4Address: "192.168.1.100",
  ipv6Address: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
  pattern: "^[a-zA-Z0-9]+$",

  // Conditional field - contactMethod triggers if-then-else
  contactMethod: "phone",
  phoneNumber: "+8613800138000",

  // Array field
  emails: ["john.backup@example.com", "work@company.org"],

  address: {
    street: "123 Tech Lane",
    city: "San Francisco",
    zipCode: "94102",
    country: "USA",
  },
  status: "active",
};
