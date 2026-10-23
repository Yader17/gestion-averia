# Firebase Setup

La app ya tiene preparada la sincronizacion en Firestore y Storage, pero solo se activa cuando completes la configuracion de Firebase en `app.json`.

Si todavia no has activado Firebase Storage, puedes usar sincronizacion de datos solamente dejando `photoSyncEnabled` en `false`.

## 1. Crear proyecto

1. Crea un proyecto en Firebase.
2. Activa `Authentication` con proveedor `Anonymous`.
3. Activa `Firestore Database` en modo nativo.
4. Activa `Storage`.

Si no quieres activar `Storage` todavia, deja `photoSyncEnabled` en `false` dentro de `expo.extra.cloudSync`.

## 2. Copiar claves al proyecto

Completa estos campos en `app.json` dentro de `expo.extra.cloudSync`:

- `firebaseApiKey`
- `firebaseAuthDomain`
- `firebaseProjectId`
- `firebaseStorageBucket`
- `firebaseMessagingSenderId`
- `firebaseAppId`
- `workspaceId`
- `photoSyncEnabled`

`workspaceId` debe ser el mismo en escritorio y movil si quieres que ambos compartan exactamente los mismos datos.

Con `photoSyncEnabled: false` se sincronizan las averias y configuraciones compartidas, pero no se suben fotos a Firebase.

## 3. Reglas minimas de Firestore

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /workspaces/{workspaceId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 4. Reglas minimas de Storage

```txt
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /workspaces/{workspaceId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 5. Que sincroniza esta base

- Averias
- Ubicaciones
- Estado solucionado
- Fotos nuevas hacia Firebase Storage cuando `photoSyncEnabled` esta activo
- Tipos personalizados de intervencion

La importacion y exportacion Excel se mantienen como respaldo manual.

## 6. Despues de configurar

1. Vuelve a compilar Android.
2. Si quieres la app de escritorio actualizada, genera tambien el instalador de Electron.
3. Abre la app en PC y movil con el mismo `workspaceId`.

Si Firestore esta vacio y uno de los dispositivos ya tiene datos locales, la app intentara sembrar la nube automaticamente la primera vez.