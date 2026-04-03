use contacts_integrity::*;
use hdk::prelude::*;

/// Entrée/sortie pour les fonctions qui modifient un contact existant
#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateContactInput {
    pub original_action_hash: ActionHash,
    pub updated_contact: Contact,
}

/// Contact avec son identifiant (retourné au frontend)
#[derive(Serialize, Deserialize, Debug)]
pub struct ContactOutput {
    pub action_hash: ActionHash,
    pub contact: Contact,
}

fn all_contacts_path() -> ExternResult<TypedPath> {
    Path::from("all_contacts").typed(LinkTypes::AllContacts)
}

fn all_contacts_filter() -> ExternResult<LinkTypeFilter> {
    Ok(LinkTypeFilter::single_dep(zome_info()?.id))
}

/// Crée un nouveau contact et l'indexe via un lien depuis l'ancre "all_contacts"
#[hdk_extern]
pub fn create_contact(contact: Contact) -> ExternResult<ContactOutput> {
    let action_hash = create_entry(EntryTypes::Contact(contact.clone()))?;

    let path = all_contacts_path()?;
    path.ensure()?;
    create_link(
        path.path_entry_hash()?,
        action_hash.clone(),
        LinkTypes::AllContacts,
        (),
    )?;

    Ok(ContactOutput {
        action_hash,
        contact,
    })
}

/// Récupère tous les contacts
#[hdk_extern]
pub fn get_all_contacts(_: ()) -> ExternResult<Vec<ContactOutput>> {
    let path = all_contacts_path()?;
    let links = get_links(
        LinkQuery::new(path.path_entry_hash()?, all_contacts_filter()?),
        GetStrategy::Network,
    )?;

    let mut contacts = Vec::new();
    for link in links {
        let action_hash = ActionHash::try_from(link.target)
            .map_err(|_| wasm_error!(WasmErrorInner::Guest("Invalid link target".to_string())))?;

        if let Some(record) = get(action_hash.clone(), GetOptions::default())? {
            if let Some(contact) = record
                .entry()
                .to_app_option::<Contact>()
                .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?
            {
                contacts.push(ContactOutput {
                    action_hash,
                    contact,
                });
            }
        }
    }

    Ok(contacts)
}

/// Met à jour un contact existant
#[hdk_extern]
pub fn update_contact(input: UpdateContactInput) -> ExternResult<ContactOutput> {
    let action_hash = update_entry(
        input.original_action_hash,
        EntryTypes::Contact(input.updated_contact.clone()),
    )?;

    Ok(ContactOutput {
        action_hash,
        contact: input.updated_contact,
    })
}

/// Supprime un contact
#[hdk_extern]
pub fn delete_contact(action_hash: ActionHash) -> ExternResult<ActionHash> {
    let path = all_contacts_path()?;
    let links = get_links(
        LinkQuery::new(path.path_entry_hash()?, all_contacts_filter()?),
        GetStrategy::Network,
    )?;

    for link in links {
        if let Ok(target_hash) = ActionHash::try_from(link.target.clone()) {
            if target_hash == action_hash {
                delete_link(link.create_link_hash, GetOptions::default())?;
                break;
            }
        }
    }

    delete_entry(action_hash.clone())?;

    Ok(action_hash)
}
