function getAimTarget() {
  let best = null, bestAngle = AIM_RADIUS;
  camDir.set(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch));
  
  const allObstacles = [...walls, ...glooWalls]; // Paredes e gelo

  for (const id in enemies) {
    const op = enemies[id];
    const toBot = op.mesh.position.clone().sub(camera.position); 
    const dist = toBot.length();
    if (dist > 50) continue; 
    
    toBot.normalize();
    const angle = camDir.angleTo(toBot);
    
    if (angle < bestAngle) {
      // NOVO: Checa se tem parede entre você e o inimigo
      raycaster.set(camera.position.clone(), toBot);
      const wallHits = raycaster.intersectObjects(allObstacles, false);
      
      // Se a parede estiver mais perto que o inimigo, ele NÃO é travado
      if (wallHits.length > 0 && wallHits[0].distance < dist - 1) continue;

      bestAngle = angle; 
      best = op;
    }
  }
  return best;
}
