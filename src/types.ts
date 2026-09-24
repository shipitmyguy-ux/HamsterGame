export type Collision = {
  mode?: string;
  policy?: string;
  normalized?: { x:number; y:number; w:number; h:number };
};

export type Archetype = {
  archetype_id:string;
  kind:string;
  collision:Collision;
  placement:Record<string,unknown>;
  interaction:Record<string,unknown>;
  sorting:Record<string,unknown>;
  defaults:Record<string,unknown>;
};

export type Entity = {
  id:string;
  name?:string;
  archetype:string;
  asset?:string;
  emoji?:string;
  position?:{x:number;y:number};
  physics?:{collision?:Collision;[key:string]:unknown};
  sorting?:{anchor_y?:number;[key:string]:unknown};
  interaction?:{radius?:number;[key:string]:unknown};
};

export type Room = {
  id:string;
  name:string;
  theme?:string;
  entities:Entity[];
  links?:string[];
};

export type World = {
  schema_version:number;
  meta:Record<string,unknown>;
  player:{start_room:string;[key:string]:unknown};
  rooms:Record<string,Room>;
  items:Record<string,unknown>;
  recipes:Record<string,unknown>;
  quests:Record<string,unknown>;
};

export type WorldPayload = {
  ok:boolean;
  channel:"draft"|"published";
  version:number;
  world:World;
  archetypes:Archetype[];
};
