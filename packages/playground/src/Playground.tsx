import { useState, useMemo, useEffect } from "react";
import type { Schema } from "@schema-ts/core";
import { Form, SimpleFieldRenderer } from "@schema-ts/react";
import { load, dump } from "js-yaml";
import { Editor } from "./Editor";
import { muiWidgetRegistry } from "./widgets";
import { XEnumExtension } from "./extensions/XEnumExtension";
import {
  // Core
  ThemeProvider,
  // Layout
  Box,
  Flex,
  Center,
  Grid,
  PanelContainer,
  PanelSection,
  EditorContainer,
  // Navigation
  AppBar,
  Toolbar,
  // Typography
  Text,
  Heading,
  SectionHeader,
  // Form
  Button,
  Select,
  SelectOption,
  // Feedback
  Alert,
  // Visual
  DecoratedDivider,
} from "./components";

export type Example = {
  name: string;
  schema: Schema;
  value: unknown;
};

export const Playground = ({ examples }: { examples?: Example[] }) => {
  const [schemaStr, setSchemaStr] = useState("");
  const [valueStr, setValueStr] = useState("");

  const [selectedExampleName, setSelectedExampleName] = useState(
    examples ? examples[0].name : undefined,
  );

  useEffect(() => {
    if (examples && selectedExampleName) {
      const example = examples.find((ex) => ex.name === selectedExampleName);
      if (example) {
        setSchemaStr(dump(example.schema));
        setValueStr(dump(example.value));
      }
    }
  }, [examples, selectedExampleName]);

  // Parse Schema
  const { schema, schemaError } = useMemo(() => {
    try {
      const parsed = load(schemaStr);
      return { schema: parsed as Schema, schemaError: null };
    } catch (error) {
      return {
        schema: null,
        schemaError: error instanceof Error ? error.message : String(error),
      };
    }
  }, [schemaStr]);

  // Parse Initial Value
  const { parsedValue, valueError } = useMemo(() => {
    try {
      const parsed = load(valueStr);
      return { parsedValue: parsed, valueError: null };
    } catch (error) {
      return {
        parsedValue: {},
        valueError: error instanceof Error ? error.message : String(error),
      };
    }
  }, [valueStr]);

  const renderer = useMemo(
    () => new SimpleFieldRenderer(muiWidgetRegistry, [XEnumExtension]),
    [],
  );

  const handleFormChange = (newValue: unknown) => {
    setValueStr(dump(newValue));
  };

  return (
    <ThemeProvider>
      <Flex direction="column" sx={{ height: "100vh" }}>
        <AppBar>
          <Toolbar>
            <Flex align="center" sx={{ flexGrow: 1 }}>
              <Heading
                level={6}
                component="div"
                sx={{ color: "primary.main", fontWeight: 800 }}
              >
                Schema-TS{" "}
                <Box
                  component="span"
                  sx={{
                    fontWeight: 500,
                    color: "text.secondary",
                    opacity: 0.8,
                  }}
                >
                  Playground
                </Box>
              </Heading>
            </Flex>
            <Flex align="center" gap={3}>
              <Select
                id="example-select"
                value={selectedExampleName ?? ""}
                onChange={setSelectedExampleName}
                size="small"
                borderless
                formControlProps={{ size: "small", sx: { minWidth: 200 } }}
              >
                {examples?.map((example) => (
                  <SelectOption key={example.name} value={example.name}>
                    {example.name}
                  </SelectOption>
                ))}
              </Select>
              <Button
                variant="soft"
                size="small"
                onClick={() => {
                  if (examples) {
                    setSelectedExampleName(examples[0].name);
                  }
                }}
              >
                Reset Example
              </Button>
            </Flex>
          </Toolbar>
        </AppBar>

        <Box sx={{ flexGrow: 1, overflow: "hidden", p: { xs: 2, md: 3 } }}>
          <Grid container spacing={3} sx={{ height: "100%" }}>
            {/* Left Panel: Inputs (Split Top/Bottom) */}
            <Grid
              size={{ xs: 12, md: 5 }}
              sx={{ height: "100%", display: "flex", flexDirection: "column" }}
            >
              <PanelContainer>
                <PanelSection>
                  <SectionHeader title="JSON Schema" />
                  <EditorContainer>
                    <Editor value={schemaStr} onChange={setSchemaStr} />
                  </EditorContainer>
                  {schemaError && (
                    <Alert severity="error" sx={{ m: 2, mt: 0 }}>
                      {schemaError}
                    </Alert>
                  )}
                </PanelSection>

                <DecoratedDivider />

                <PanelSection>
                  <SectionHeader title="Values" />
                  <EditorContainer>
                    <Editor value={valueStr} onChange={setValueStr} />
                  </EditorContainer>
                  {valueError && (
                    <Alert severity="error" sx={{ m: 2, mt: 0 }}>
                      {valueError}
                    </Alert>
                  )}
                </PanelSection>
              </PanelContainer>
            </Grid>

            {/* Right Panel: Output */}
            <Grid
              size={{ xs: 12, md: 7 }}
              sx={{ height: "100%", display: "flex", flexDirection: "column" }}
            >
              <PanelContainer>
                <SectionHeader title="Real-time UI Preview" />
                <Box
                  sx={{ flexGrow: 1, overflow: "auto", p: { xs: 2, md: 4 } }}
                >
                  {schema ? (
                    <Form
                      schema={schema}
                      value={parsedValue}
                      onChange={handleFormChange}
                      render={renderer.render}
                    />
                  ) : (
                    <Center sx={{ height: "100%" }}>
                      <Text color="text.secondary">
                        Provide a valid JSON Schema to see the UI
                      </Text>
                    </Center>
                  )}
                </Box>
              </PanelContainer>
            </Grid>
          </Grid>
        </Box>
      </Flex>
    </ThemeProvider>
  );
};
