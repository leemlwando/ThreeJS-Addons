import { Scene, PerspectiveCamera } from 'three';
import { Vector3 } from 'three/src/math/Vector3';
import { generateUUID } from 'three/src/math/MathUtils';
import { CameraControlType, CameraControllerType, ControlType, Index, configureControllerArgsType } from '../../types';
import { OrbitControlsWrapper, PointerLockControlsWrapper } from '../../wrappers';


/**
 * @description CameraController class for managing camera and its respective controls.
 */
export class CameraController {
    controllers: CameraControllerType[] = [];
    activeController: CameraControllerType | null = null;

    /**confgurations */
    loopControllerIndex: boolean = true;

    /** track controllers */
    currentControllerIndex: Index = 0;
    previousControllerIndex: Index | null = 0;

    /** track controls */
    currentControlTypeIndex: Index = 0;
    previousControlTypeIndex: Index | null = 0;
    loopControlTypeIndex: boolean = true;

    /** scene */
    scene: Scene | null = null 

    constructor(args: { scene: Scene }){
        if(args.scene !== null){
            this.scene = args.scene
        }
    }

    /** switch controllers */
    switchControllerNext(index: Index | null): Index | null {
      
        this.previousControllerIndex = this.currentControllerIndex;

        this.currentControllerIndex = index ? index : this.currentControllerIndex + 1;

        const activeControlType = this.getCurrentActiveControlType();

        if(!activeControlType) return null;

        if(this.currentControllerIndex > this.controllers.length - 1){

            if(index) throw new Error(`[CameraController] index ${index} is out of range`);
            
            if(!this.loopControllerIndex) return this.currentControllerIndex;

            this.currentControllerIndex = 0;
        }

        /** disable previous controlls */
        this.disableControlsByControllerIndex(this.previousControllerIndex);

        /** enable only controller on active index */
        this.controllers.forEach((controller: CameraControllerType, index: Index) => controller.active = index === this.currentControllerIndex)

        this.activeController = this.controllers[this.currentControllerIndex];

        /** enable active controlls */
        this.enableActiveControllerControl(activeControlType);

        return this.currentControllerIndex;
    }

    /** toggle controls */
    switchControlTypeNext(index: Index | null): Index {
 
        this.previousControlTypeIndex = this.currentControlTypeIndex;
        this.currentControlTypeIndex = index ? index : this.currentControlTypeIndex + 1;

        if((this.currentControlTypeIndex) > this.controllers[this.currentControllerIndex].controls.length - 1){
            if(index !== null)throw new Error(`[CameraController] index ${index} is out of range`);

            if(!this.loopControlTypeIndex) return this.currentControlTypeIndex;

            this.currentControlTypeIndex = 0;
        }

       this.toggleControlTypeByIndex(this.previousControlTypeIndex, this.currentControlTypeIndex);

       return this.currentControlTypeIndex;
    }

    /** configure each controller to add to the controllers list */
    configureController( args: configureControllerArgsType ): void {

        if(!args) throw new Error('no options passed to configure');

        const controller: CameraControllerType = { 
            camera: args.camera as PerspectiveCamera,
            controls: [],
            active: args.active
        }

        /** add camera to scene */

        if(this.scene !== null){
            this.scene.add(controller.camera);
        }

        /** configure camera */
        controller.camera.aspect = window.innerWidth/window.innerHeight;
        controller.camera.fov = 75;
        controller.camera.updateProjectionMatrix();

        for(const control of  args.controls){

            if(control.type === ControlType.ORBIT_CONTROLS){

            const orbitControls = new OrbitControlsWrapper( args.camera, args.domElement );

            for(const option in control.options){
                orbitControls[option] = control.options[option];
            }

            orbitControls.userData = { uuid: generateUUID(), type: ControlType.ORBIT_CONTROLS, active: false };

            controller.controls.push(orbitControls);

            }

            if(control.type === ControlType.POINTER_LOCK_CONTROLS){

            const pointerControls = new PointerLockControlsWrapper( args.camera, args.domElement );

            for(const option in control.options){
                pointerControls[option] = control.options[option];
            }

            pointerControls.userData = { uuid: generateUUID(), type: ControlType.POINTER_LOCK_CONTROLS, active: false };

            controller.controls.push(pointerControls);

            }
        }

        this.controllers.push(controller);
    }

    /** set the active controller from your list of controllers */
    setActiveController(index: Index, disableCurrentController: boolean): void {

        if(index > this.controllers.length - 1) throw new Error(`index ${index} is out of range`);
        
        this.currentControllerIndex = index;

        this.controllers.forEach((controller: CameraControllerType, index: Index) => controller.active = index === this.currentControllerIndex);

        let previouslyActiveController = this.activeController;

        if(!previouslyActiveController){
            this.activeController = this.controllers[this.currentControllerIndex];

            this.activeController.camera.aspect = window.innerWidth/window.innerHeight;
            this.updateProjectionMatrix();

            this.activeController.controls.forEach(control => {

                if(control.userData.type === ControlType.ORBIT_CONTROLS){
                    control.userData.active = true;
                    control.enabled = true;
                    control.update()
                }
            })

            return;
        }


        let activeControlType = this.getCurrentActiveControlType();

        this.activeController = this.controllers[this.currentControllerIndex];

        this.activeController.camera.aspect = window.innerWidth/window.innerHeight;
        this.updateProjectionMatrix();

        previouslyActiveController.controls.forEach(control => control.userData.active = false );

        this.activeController?.controls.forEach(control => control.userData.active = !activeControlType ? control.userData.type === ControlType.ORBIT_CONTROLS : control.userData.type === activeControlType);

    }

    /** get active control type */
    getCurrentActiveControlType(): ControlType.ORBIT_CONTROLS | ControlType.POINTER_LOCK_CONTROLS | null {

       let activeControl = this.activeController?.controls.find(control => control.userData.active === true)

       if(!activeControl) return null;

       return activeControl?.userData.type;
    }

    /** reszie camera aspect ratio */
    onResize({ width, height }: { width: number, height: number }): void{
        if(!this.activeController)return;
        this.activeController.camera.aspect  = width/height;
        this.updateProjectionMatrix();
    }

    /** calls updateProjectionMatrix on current active camera */
    updateProjectionMatrix(): void{
        if(!this.activeController)return;
        let c = this.activeController.camera as PerspectiveCamera
        c.updateProjectionMatrix();
    }

    /** disable previous controls */
    private disableControlsByControllerIndex(index: Index): void {

        if(index === null || index === undefined) return;

        this.controllers[index].controls.forEach((control) => {

            if(!control.userData) return;

            control.userData.active = false

            if('update' in control && control.userData.type === ControlType.ORBIT_CONTROLS){
                control.enabled = false;
                control.update();
            }

            if('disconnect' in control && control.userData.type === ControlType.POINTER_LOCK_CONTROLS){
                control.unlock();
                control.disconnect();
            }
        })
    }

    /** enable active controllers control by activeControlType */
    private enableActiveControllerControl(activeControlType: CameraControlType ): void {

        if(!this.activeController)return;

        this.activeController.controls.forEach(control => {

            if(!control.userData) return;

            control.userData.active = control.userData.type === activeControlType;

            if('update' in control && control.userData.type === ControlType.ORBIT_CONTROLS && activeControlType === ControlType.ORBIT_CONTROLS){
                control.enabled = true;
                control.update();
            }

            if( 'lock' in control && control.userData.type === ControlType.POINTER_LOCK_CONTROLS && activeControlType === ControlType.POINTER_LOCK_CONTROLS){
                control.connect();
                control.lock();
            }
        })
    }

    /** toggle Control By index */
    private toggleControlTypeByIndex(previousControlTypeIndex: Index, currentControlTypeIndex: Index): void {

        if(!this.activeController) return;

        if(previousControlTypeIndex === null || previousControlTypeIndex === undefined) return;

        let prevControl  = this.activeController.controls[ previousControlTypeIndex ] as OrbitControlsWrapper | PointerLockControlsWrapper;

        if(!prevControl) return;

        if(!prevControl.userData) return;

        prevControl.userData.active = false;

        if( 'update' in prevControl && prevControl?.userData.type === ControlType.ORBIT_CONTROLS){
            prevControl.enabled = false;
            prevControl.update();
         }

         if( 'unlock' in prevControl && prevControl?.userData.type === ControlType.POINTER_LOCK_CONTROLS){
            prevControl.unlock();
            prevControl.disconnect();
         }

         let currControl = this.activeController?.controls[ currentControlTypeIndex ]

         if(!currControl) return;

        if(!currControl.userData) return;

         currControl.userData.active = true;
 
         if('update' in currControl && currControl?.userData.type === ControlType.ORBIT_CONTROLS){
            /** get previous controls look direction */
            const lookdirection = new Vector3();
            prevControl.getDirection(lookdirection);

            const lookAtPoint = new  Vector3().copy(this.activeController.camera.position).add(lookdirection);
            currControl.target.copy(lookAtPoint);
            currControl.enabled = true;
            currControl.update();
         }
 
         if('lock' in currControl && currControl?.userData.type === ControlType.POINTER_LOCK_CONTROLS){
             currControl.connect();
             currControl.lock();
         }
    }
}