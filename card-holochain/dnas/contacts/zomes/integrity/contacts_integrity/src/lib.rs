use hdi::prelude::*;

/// Structure représentant un Contact
#[hdk_entry_helper]
#[derive(Clone)]
pub struct Contact {
    pub nom: String,
    pub prenom: String,
    pub email: String,
    pub telephone: String,
}

/// Types d'entrées du zome integrity
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    #[entry_type]
    Contact(Contact),
}

/// Types de liens utilisés pour indexer les contacts
#[hdk_link_types]
pub enum LinkTypes {
    AllContacts,
}

/// Validation — on accepte toutes les opérations pour l'instant.
/// Les règles métier (nom/prénom obligatoires) sont appliquées côté coordinator.
#[hdk_extern]
pub fn validate(_op: Op) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}
