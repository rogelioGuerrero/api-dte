#!/usr/bin/env node

/**
 * Workflow completo: Build → Test → Commit → Push
 * Uso: node scripts/build-and-commit.js "mensaje del commit"
 */

const { execSync } = require('child_process');
const { autoCommitAndPush } = require('./auto-commit');

const commitMessage = process.argv[2] || 'Auto-commit: Actualización post-build';

function runCommand(command, cwd = process.cwd()) {
  try {
    console.log(`🔧 Ejecutando: ${command}`);
    const result = execSync(command, { 
      cwd, 
      stdio: 'pipe', 
      encoding: 'utf8' 
    });
    console.log(`✅ Comando completado: ${command}`);
    return result.trim();
  } catch (error) {
    console.error(`❌ Error ejecutando: ${command}`);
    console.error(error.message);
    throw error;
  }
}

async function buildAndCommit() {
  try {
    console.log('🚀 Iniciando workflow completo: Build → Test → Commit → Push\n');
    
    // 1. Limpiar build anterior
    console.log('🧹 Limpiando build anterior...');
    runCommand('npm run clean');
    
    // 2. Ejecutar build
    console.log('📦 Ejecutando build...');
    runCommand('npm run build');
    
    // 3. Ejecutar tests (opcional)
    console.log('🧪 Ejecutando tests...');
    try {
      runCommand('npm test');
      console.log('✅ Todos los tests pasaron');
    } catch (error) {
      console.log('⚠️ Los tests fallaron, pero continuando con el commit...');
    }
    
    // 4. Verificar que el build fue exitoso
    console.log('🔍 Verificando build...');
    const fs = require('fs');
    const distPath = './dist';
    if (!fs.existsSync(distPath)) {
      throw new Error('El directorio dist/ no existe. El build falló.');
    }
    
    // 5. Commit y push
    console.log('\n📝 Iniciando proceso de Git...');
    autoCommitAndPush(commitMessage);
    
    console.log('\n🎉 Workflow completado exitosamente!');
    console.log('✅ Build → Test → Commit → Push completado');
    
  } catch (error) {
    console.error('\n❌ Error en el workflow:', error.message);
    console.log('💡 No se realizó el commit debido a errores en el build');
    process.exit(1);
  }
}

// Ejecutar el workflow
if (require.main === module) {
  buildAndCommit();
}

module.exports = { buildAndCommit };
