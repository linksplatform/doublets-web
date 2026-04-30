//! Test suite for the Web and headless browsers.

#![cfg(target_arch = "wasm32")]

extern crate wasm_bindgen_test;

use doublets_web::{Link, UnitedLinks};
use wasm_bindgen_test::*;

#[wasm_bindgen_test]
fn united_links_crud_round_trip() {
    let mut links = UnitedLinks::new(None).unwrap();
    let constants = links.constants();

    let link = links.create().unwrap();
    assert!(link > constants.null);

    assert_eq!(links.update(link, link, link).unwrap(), link);
    assert_eq!(links.count(Some(Link::new(constants.any, link, link))), 1);

    assert_eq!(links.delete(link).unwrap(), link);
    assert_eq!(links.count(None), 0);
}
