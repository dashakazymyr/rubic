function Rubik(element, dimensions, background) {

  dimensions = dimensions || 3;
  background = background || 0x303030;

  var width = element.innerWidth(),
      height = element.innerHeight();

  var debug = false;

  var scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000),
      renderer = new THREE.WebGLRenderer({ antialias: true });

  renderer.setClearColor(background, 1.0);
  renderer.setSize(width, height);
  renderer.shadowMapEnabled = true;
  element.append(renderer.domElement);

  camera.position = new THREE.Vector3(-20, 20, 30);
  camera.lookAt(scene.position);
  THREE.Object3D._threexDomEvent.camera(camera);

  scene.add(new THREE.AmbientLight(0xffffff));



  var orbitControl = new THREE.OrbitControls(camera, renderer.domElement);

  function enableCameraControl() {
    orbitControl.noRotate = false;
  }

  function disableCameraControl() {
    orbitControl.noRotate = true;
  }


  if(debug) {
    scene.add(new THREE.AxisHelper( 20 ));
  }


  var SCREEN_HEIGHT = window.innerHeight;
  var SCREEN_WIDTH = window.innerWidth;

  var raycaster = new THREE.Raycaster(),
      projector = new THREE.Projector();

  function isMouseOverCube(mouseX, mouseY) {
    var directionVector = new THREE.Vector3();

    //Normalise mouse x and y
    var x = ( mouseX / SCREEN_WIDTH ) * 2 - 1;
    var y = -( mouseY / SCREEN_HEIGHT ) * 2 + 1;

    directionVector.set(x, y, 1);

    projector.unprojectVector(directionVector, camera);
    directionVector.sub(camera.position);
    directionVector.normalize();
    raycaster.set(camera.position, directionVector);

    return raycaster.intersectObjects(allCubes, true).length > 0;
  }

  function principalComponent(v) {
    var maxAxis = 'x',
        max = Math.abs(v.x);
    if(Math.abs(v.y) > max) {
      maxAxis = 'y';
      max = Math.abs(v.y);
    }
    if(Math.abs(v.z) > max) {
      maxAxis = 'z';
      max = Math.abs(v.z);
    }
    return maxAxis;
  }


  var clickVector, clickFace;

 
  var lastCube;

  var onCubeMouseDown = function(e, cube) {
    disableCameraControl();

  
    if(true || !isMoving) {
      clickVector = cube.rubikPosition.clone();
      
      var centroid = e.targetFace.centroid.clone();
      centroid.applyMatrix4(cube.matrixWorld);

      //Which face (of the overall cube) did we click on?
      if(nearlyEqual(Math.abs(centroid.x), maxExtent))
        clickFace = 'x';
      else if(nearlyEqual(Math.abs(centroid.y), maxExtent))
        clickFace = 'y';
      else if(nearlyEqual(Math.abs(centroid.z), maxExtent))
        clickFace = 'z';    
    }  
  };


  //    F a c e
  // D    X Y Z
  // r  X - Z Y
  // a  Y Z - X
  // g  Z Y X -
  var transitions = {
    'x': {'y': 'z', 'z': 'y'},
    'y': {'x': 'z', 'z': 'x'},
    'z': {'x': 'y', 'y': 'x'}
  }

  var onCubeMouseUp = function(e, cube) {

    if(clickVector) {
    
      var dragVector = cube.rubikPosition.clone();
      dragVector.sub(clickVector);

 
      if(dragVector.length() > cubeSize) {

       
        var dragVectorOtherAxes = dragVector.clone();
        dragVectorOtherAxes[clickFace] = 0;

        var maxAxis = principalComponent(dragVectorOtherAxes);

        var rotateAxis = transitions[clickFace][maxAxis],
            direction = dragVector[maxAxis] >= 0 ? 1 : -1;
        
   
        if(clickFace == 'z' && rotateAxis == 'x' || 
           clickFace == 'x' && rotateAxis == 'z' ||
           clickFace == 'y' && rotateAxis == 'z')
          direction *= -1;

        if(clickFace == 'x' && clickVector.x > 0 ||
           clickFace == 'y' && clickVector.y < 0 ||
           clickFace == 'z' && clickVector.z < 0)
          direction *= -1;

        pushMove(cube, clickVector.clone(), rotateAxis, direction);
        startNextMove();
        enableCameraControl();
      } else {
        console.log("Drag me some more please!");
      }
    }
  };

  var onCubeMouseOut = function(e, cube) {
    
    lastCube = cube;
  }

  element.on('mouseup', function(e) {
    if(!isMouseOverCube(e.clientX, e.clientY)) {
      if(lastCube)
        onCubeMouseUp(e, lastCube);
    }
  });


  var colours = [0xC41E3A, 0x009E60, 0x0051BA, 0xFF5800, 0xFFD500, 0xFFFFFF],
      faceMaterials = colours.map(function(c) {
        return new THREE.MeshLambertMaterial({ color: c , ambient: c });
      }),
      cubeMaterials = new THREE.MeshFaceMaterial(faceMaterials);

  var cubeSize = 3,
      spacing = 0.5;

  var increment = cubeSize + spacing,
      maxExtent = (cubeSize * dimensions + spacing * (dimensions - 1)) / 2, 
      allCubes = [];

  function newCube(x, y, z) {
    var cubeGeometry = new THREE.CubeGeometry(cubeSize, cubeSize, cubeSize);
    var cube = new THREE.Mesh(cubeGeometry, cubeMaterials);
    cube.castShadow = true;

    cube.position = new THREE.Vector3(x, y, z);
    cube.rubikPosition = cube.position.clone();

    cube.on('mousedown', function(e) {
      onCubeMouseDown(e, cube);
    });

    cube.on('mouseup', function(e) {
      onCubeMouseUp(e, cube);
    });

    cube.on('mouseout', function(e) {
      onCubeMouseOut(e, cube);
    });

    scene.add(cube);
    allCubes.push(cube);
  }

  var positionOffset = (dimensions - 1) / 2;
  for(var i = 0; i < dimensions; i ++) {
    for(var j = 0; j < dimensions; j ++) {
      for(var k = 0; k < dimensions; k ++) {

        var x = (i - positionOffset) * increment,
            y = (j - positionOffset) * increment,
            z = (k - positionOffset) * increment;

        newCube(x, y, z);
      }
    }
  }


  var moveEvents = $({});


  var moveQueue = [],
      completedMoveStack = [],
      currentMove;


  var isMoving = false,
      moveAxis, moveN, moveDirection,
      rotationSpeed = 0.2;


  var pivot = new THREE.Object3D(),
      activeGroup = [];

  function nearlyEqual(a, b, d) {
    d = d || 0.001;
    return Math.abs(a - b) <= d;
  }

 
  function setActiveGroup(axis) {
    if(clickVector) {
      activeGroup = [];

      allCubes.forEach(function(cube) {
        if(nearlyEqual(cube.rubikPosition[axis], clickVector[axis])) { 
          activeGroup.push(cube);
        }
      });
    } else {
      console.log("Nothing to move!");
    }
  }

  var pushMove = function(cube, clickVector, axis, direction) {
    moveQueue.push({ cube: cube, vector: clickVector, axis: axis, direction: direction });
  }

  var startNextMove = function() {
    var nextMove = moveQueue.pop();

    if(nextMove) {
      clickVector = nextMove.vector;
      
      var direction = nextMove.direction || 1,
          axis = nextMove.axis;

      if(clickVector) {

        if(!isMoving) {
          isMoving = true;
          moveAxis = axis;
          moveDirection = direction;

          setActiveGroup(axis);

          pivot.rotation.set(0,0,0);
          pivot.updateMatrixWorld();
          scene.add(pivot);

          activeGroup.forEach(function(e) {
            THREE.SceneUtils.attach(e, scene, pivot);
          });

          currentMove = nextMove;
        } else {
          console.log("Already moving!");
        }
      } else {
        console.log("Nothing to move!");
      }
    } else {
      moveEvents.trigger('deplete');
    }
  }

  function doMove() {
   
    if(pivot.rotation[moveAxis] >= Math.PI / 2) {
     
   pivot.rotation[moveAxis] = Math.PI / 2;
      moveComplete();
    } else if(pivot.rotation[moveAxis] <= Math.PI / -2) {
      pivot.rotation[moveAxis] = Math.PI / -2;
      moveComplete()
    } else {
      pivot.rotation[moveAxis] += (moveDirection * rotationSpeed);
    }
  }

  var moveComplete = function() {
    isMoving = false;
    moveAxis, moveN, moveDirection = undefined;
    clickVector = undefined;
    pivot.updateMatrixWorld();
    scene.remove(pivot);
    activeGroup.forEach(function(cube) {
      cube.updateMatrixWorld();

      cube.rubikPosition = cube.position.clone();
      cube.rubikPosition.applyMatrix4(pivot.matrixWorld);

      THREE.SceneUtils.detach(cube, pivot, scene);
    });

    completedMoveStack.push(currentMove);

    moveEvents.trigger('complete');

  
    startNextMove();
  }


  function render() {

  
    if(isMoving) {
      doMove();
    } 

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }


  render();


  return {
    shuffle: function() {
      function randomAxis() {
        return ['x', 'y', 'z'][randomInt(0,2)];
      }

      function randomDirection() {
        var x = randomInt(0,1);
        if(x == 0) x = -1;
        return x;
      }

      function randomCube() {
        var i = randomInt(0, allCubes.length - 1);
        
        return allCubes[i];
      }

      var nMoves = randomInt(10, 40);
      for(var i = 0; i < nMoves; i ++) {
        var cube = randomCube();
        pushMove(cube, cube.position.clone(), randomAxis(), randomDirection());
      }

      startNextMove();
    },


    solve: function() {
      if(!isMoving) {
        completedMoveStack.forEach(function(move) {
          pushMove(move.cube, move.vector, move.axis, move.direction * -1);
        });

        
        completedMoveStack = [];

        moveEvents.one('deplete', function() {
          completedMoveStack = [];
        });

        startNextMove();
      }
    },

   
    undo: function() {
      if(!isMoving) {
        var lastMove = completedMoveStack.pop();
        if(lastMove) {
   
          var stackToRestore = completedMoveStack.slice(0);
          pushMove(lastMove.cube, lastMove.vector, lastMove.axis, lastMove.direction * -1);

          moveEvents.one('complete', function() {
            completedMoveStack = stackToRestore;
          });

          startNextMove();
        }
      }
    }
  }
}
