---
description: Flujo completo para finalizar tareas con build, pruebas y deploy
---

# Workflow: Completar Tarea

Este workflow automatiza el proceso de finalización de tareas, incluyendo validación, build y deploy.

## Pasos

### 1. Verificar tipos (Type Checking)
// turbo
Ejecuta la verificación de tipos TypeScript para asegurar que no hay errores de tipado.
```bash
npm run typecheck
```

### 2. Build del proyecto
Compila el proyecto para producción, optimizando todos los assets.
```bash
npm run build
```

### 3. Agregar cambios al staging
Agrega todos los archivos modificados al área de staging de Git.
```bash
git add .
```

### 4. Crear commit inteligente
Crea un commit con un mensaje generado automáticamente basado en los archivos modificados:
- `feat:` para nuevas funcionalidades
- `fix:` para correcciones
- `refactor:` para refactorizaciones
- `chore:` para tareas de mantenimiento

```bash
git commit -m "$(node -e "
const fs = require('fs');
const { execSync } = require('child_process');

// Obtener archivos modificados
const files = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

// Determinar tipo de cambio
let type = 'chore';
if (files.some(f => f.includes('components/') || f.includes('pages/'))) type = 'feat';
if (files.some(f => f.includes('fix') || f.includes('bug'))) type = 'fix';
if (files.some(f => f.includes('utils/') || f.includes('lib/'))) type = 'refactor';

// Generar mensaje
const message = `${type}: cambios actualizados en archivos principales`;
console.log(message);
")"
```

### 5. Push a GitHub
Sube todos los cambios al repositorio remoto en GitHub.
```bash
git push
```

### 6. Deploy automático (si aplica)
Si el proyecto tiene configurado deploy automático (GitHub Actions, Netlify, Vercel), este se activará automáticamente después del push.

## Uso

Para ejecutar este workflow:
1. Abre la paleta de comandos de Windsurf (Cmd/Ctrl + Shift + P)
2. Busca "Workflow: Completar Tarea"
3. Sigue los pasos indicados

O ejecuta directamente con el comando:
```bash
npm run complete-task
```

## Requisitos

- Tener Git configurado
- Estar en un repositorio de Git
- Tener conexión a internet para el push
- No tener cambios sin commitear en el working directory (o hacer stash primero)

## Notas

- Si el type checking falla, el workflow se detendrá
- Si el build falla, no se hará el commit
- Si no hay cambios para commitear, el workflow lo indicará
- El deploy automático depende de la configuración del proyecto (GitHub Actions, Netlify, etc.)
