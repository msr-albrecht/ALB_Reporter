import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
    url: 'https://139.162.154.60:8443',
    realm: 'berichte',
    clientId: 'berichte-app'
});

export async function initKeycloak() {
    try {
        const authenticated = await keycloak.init({ onLoad: 'login-required' });
        return authenticated;
    } catch (error) {
        console.error('Keycloak-Initialisierung fehlgeschlagen:', error);
        return false;
    }
}

export function login() {
    keycloak.login();
}

export function logout() {
    keycloak.logout();
}

export function getUser() {
    return keycloak.tokenParsed ? keycloak.tokenParsed.preferred_username : null;
}

export function hasVerwalterRole() {
    return keycloak.hasRealmRole('verwalter');
}
