import { useState } from "react";
import { Add as AddIcon } from "@mui/icons-material";
import { type ObjectWidgetProps } from "@schema-ts/react";
import {
  FieldGroup,
  Button,
  Flex,
  ListItem,
  TextField,
  Box,
} from "../components";

/**
 * Object Widget
 * Uses public FieldGroup component, no extra style code
 */
export function DefaultObjectWidget({
  label,
  description,
  required,
  error,
  properties,
  canAddProperty,
  onAddProperty,
}: ObjectWidgetProps) {
  const [newPropKey, setNewPropKey] = useState("");

  const handleAdd = () => {
    const key = newPropKey.trim();
    if (key) {
      onAddProperty(key);
      setNewPropKey("");
    }
  };

  return (
    <FieldGroup
      label={label}
      description={description}
      required={required}
      error={error}
    >
      <Flex direction="column" gap={2} sx={{ mt: 1 }}>
        {properties?.map((prop) => (
          <ListItem
            key={prop.key}
            onDelete={prop.canRemove ? prop.onRemove : undefined}
            label={prop.key}
          >
            {prop.content}
          </ListItem>
        ))}
      </Flex>

      {canAddProperty && (
        <Box sx={{ mt: 2, display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="Property name"
            value={newPropKey}
            onChange={(e) => setNewPropKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            sx={{ flex: 1 }}
          />
          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            size="small"
            onClick={handleAdd}
            disabled={!newPropKey.trim()}
          >
            Add Property
          </Button>
        </Box>
      )}
    </FieldGroup>
  );
}
