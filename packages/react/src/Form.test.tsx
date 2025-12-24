/**
 * @vitest-environment jsdom
 */
import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { Schema } from "@schema-ts/core";
import { Form } from "./Form";

describe("Form", () => {
  it("calls onChange when value changes", () => {
    const handleChange = vi.fn();
    const schema: Schema = { type: "string" };

    const { getByRole } = render(
      <Form
        schema={schema}
        onChange={handleChange}
        render={(props) => (
          <input
            role="textbox"
            value={(props.value as string) || ""}
            onChange={(e) => props.onChange(e.target.value)}
          />
        )}
      />,
    );

    const input = getByRole("textbox");
    fireEvent.change(input, { target: { value: "hello" } });

    expect(handleChange).toHaveBeenCalledWith("hello");
  });
});
