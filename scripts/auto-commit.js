#!/usr/bin/env node

/**
 * Workflow automatizado para Git: Commit y Push después de cambios
 * Uso: node scripts/auto-commit.js "mensaje del commit"
 */

const { execSync } = require('child_process');
const path = require('path');

const commitMessage = process.argv[2] || 'Auto-commit: Actualización de código';

function runCommand(command, cwd = process.cwd()) {
  try {
    const result = execSync(command, { 
      cwd, 
      stdio: 'pipe', 
      encoding: 'utf8' 
    });
    return result.trim();
  } catch (error) {
    console.error(`Error ejecutando: ${command}`);
    console.error(error.message);
    throw error;
  }
}

function checkGitChanges() {
  try {
    const status = runCommand('git status --porcelain');
    return status.length > 0;
  } catch (error) {
    console.error('Error verificando cambios Git:', error.message);
    return false;
  }
}

function getCurrentBranch() {
  try {
    return runCommand('git rev-parse --abbrev-ref HEAD');
  } catch (error) {
    console.error('Error obteniendo branch actual:', error.message);
    return 'main';
  }
}

function autoCommitAndPush() {
  try {
    const repoPath = process.cwd();
    console.log(`🔍 Verificando cambios en: ${repoPath}`);
    
    // Verificar si hay cambios
    if (!checkGitChanges()) {
      console.log('✅ No hay cambios pendientes. Nada que commit.');
      return;
    }
    
    console.log('📝 Cambios detectados. Iniciando workflow...');
    
    // Verificar branch actual
    const currentBranch = getCurrentBranch();
    console.log(`🌿 Branch actual: ${currentBranch}`);
    
    // Agregar todos los cambios
    console.log('➕ Agregando archivos al staging...');
    runCommand('git add .');
    
    // Verificar qué se va a commitear
    const stagedFiles = runCommand('git diff --cached --name-only');
    console.log('📋 Archivos en staging:');
    stagedFiles.split('\n').filter(f => f).forEach(file => {
      console.log(`   - ${file}`);
    });
    
    // Crear commit
    console.log(`💾 Creando commit: "${commitMessage}"`);
    const commitHash = runCommand(`git commit -m "${commitMessage}"`);
    console.log(`✅ Commit creado: ${commitHash.split('\n')[0]}`);
    
    // Hacer push
    console.log(`🚀 Haciendo push a origin/${currentBranch}...`);
    const pushResult = runCommand(`git push origin ${currentBranch}`);
    console.log('🎉 Push exitoso!');
    
    // Mostrar resumen
    console.log('\n📊 Resumen de la operación:');
    console.log(`   - Branch: ${currentBranch}`);
    console.log(`   - Commit: ${commitMessage}`);
    console.log(`   - Archivos: ${stagedFiles.split('\n').filter(f => f).length}`);
    console.log(`   - Estado: Completado ✅`);
    
  } catch (error) {
    console.error('❌ Error en el workflow automatizado:', error.message);
    process.exit(1);
  }
}

// Ejecutar el workflow
if (require.main === module) {
  autoCommitAndPush();
}

module.exports = { autoCommitAndPush, checkGitChanges };
