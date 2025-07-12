use std::{fmt, sync::Arc};
use json::JsonValue;
use serde::{Serialize, Serializer};

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct ArcString(pub Arc<String>);

impl Serialize for ArcString {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.0.as_str())
    }
}

impl From<ArcString> for JsonValue {
    fn from(val: ArcString) -> Self {
        JsonValue::String((*val.0).clone())
    }
}

impl fmt::Display for ArcString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}