if not game:IsLoaded() then game.Loaded:Wait() end

-- Hủy bỏ (Clean up) toàn bộ GUI cũ của Thức Hub nếu đã chạy trước đó để không bị trùng lặp
pcall(function()
    for _, gui in pairs(game:GetService("CoreGui"):GetChildren()) do
        if gui.Name == "ThucHubUltimate" or gui.Name == "ThucHubModern" then
            gui:Destroy()
        end
    end
end)

local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer
local RunService = game:GetService("RunService")
local VirtualUser = game:GetService("VirtualUser")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")
local Lighting = game:GetService("Lighting")

LocalPlayer.Idled:Connect(function()
    VirtualUser:Button2Down(Vector2.new(0,0), Workspace.CurrentCamera.CFrame)
    task.wait(1)
    VirtualUser:Button2Up(Vector2.new(0,0), Workspace.CurrentCamera.CFrame)
end)

local ThucConfig = {
    AutoFarmLevel = false,
    AutoFarmNearest = false,
    AutoFarmBoss = false,
    AutoChest = false,
    AutoBounty = false,
    AutoStatsMelee = false,
    AutoStatsDefense = false,
    AutoStatsSword = false,
    AutoStatsGun = false,
    AutoStatsFruit = false,
    AutoRaid = false,
    AutoAwakening = false,
    AutoHaki = false,
    AutoKenHaki = false,
    AutoMaterial = false,
    ESPPlayer = false,
    ESPFruit = false,
    ESPChest = false,
    ESPBoss = false,
    ESPIsland = false,
    NoClip = false,
    InfiniteDash = false,
    FlyMode = false,
    WalkSpeedBoost = false,
    SpeedVal = 50,
    JumpPowerBoost = false,
    JumpVal = 100,
    FullBright = false,
    RemoveFog = false,
    Aimbot = false,
    HitboxExpander = false,
    HitboxSize = 10,
    AutoClicker = false,
}

local ScreenGui = Instance.new("ScreenGui")
ScreenGui.Name = "ThucHubUltimate"
ScreenGui.Parent = game:GetService("CoreGui")
ScreenGui.ResetOnSpawn = false

local ToggleButton = Instance.new("ImageButton")
ToggleButton.Name = "ToggleButton"
ToggleButton.Parent = ScreenGui
ToggleButton.BackgroundColor3 = Color3.fromRGB(15, 15, 25)
ToggleButton.Position = UDim2.new(0.03, 0, 0.35, 0)
ToggleButton.Size = UDim2.new(0, 60, 0, 60)
ToggleButton.Draggable = true
ToggleButton.AutoButtonColor = true

local ToggleCorner = Instance.new("UICorner")
ToggleCorner.CornerRadius = UDim.new(1, 0)
ToggleCorner.Parent = ToggleButton

local ToggleStroke = Instance.new("UIStroke")
ToggleStroke.Color = Color3.fromRGB(255, 215, 0)
ToggleStroke.Thickness = 2.5
ToggleStroke.Parent = ToggleButton

local ToggleLabel = Instance.new("TextLabel")
ToggleLabel.Parent = ToggleButton
ToggleLabel.BackgroundTransparency = 1
ToggleLabel.Size = UDim2.new(1, 0, 1, 0)
ToggleLabel.Font = Enum.Font.GothamBold
ToggleLabel.Text = "👑"
ToggleLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
ToggleLabel.TextSize = 26

local MainFrame = Instance.new("Frame")
MainFrame.Name = "MainFrame"
MainFrame.Parent = ScreenGui
MainFrame.BackgroundColor3 = Color3.fromRGB(12, 12, 18)
MainFrame.Position = UDim2.new(0.2, 0, 0.15, 0)
MainFrame.Size = UDim2.new(0, 580, 0, 480)
MainFrame.Active = true
MainFrame.Draggable = true
MainFrame.Visible = false

local MainCorner = Instance.new("UICorner")
MainCorner.CornerRadius = UDim.new(0, 10)
MainCorner.Parent = MainFrame

local MainStroke = Instance.new("UIStroke")
MainStroke.Color = Color3.fromRGB(70, 70, 110)
MainStroke.Thickness = 1.5
MainStroke.Parent = MainFrame

local Header = Instance.new("Frame")
Header.Parent = MainFrame
Header.BackgroundColor3 = Color3.fromRGB(18, 18, 28)
Header.Size = UDim2.new(1, 0, 0, 45)

local HeaderCorner = Instance.new("UICorner")
HeaderCorner.CornerRadius = UDim.new(0, 10)
HeaderCorner.Parent = Header

local TitleText = Instance.new("TextLabel")
TitleText.Parent = Header
TitleText.BackgroundTransparency = 1
TitleText.Position = UDim2.new(0.02, 0, 0, 0)
TitleText.Size = UDim2.new(0.8, 0, 1, 0)
TitleText.Font = Enum.Font.GothamBold
TitleText.Text = "⚡ THỨC HUB ULTIMATE - PRO SCRIPT (RESET ACTIVE) ⚡"
TitleText.TextColor3 = Color3.fromRGB(255, 215, 0)
TitleText.TextSize = 14
TitleText.TextXAlignment = Enum.TextXAlignment.Left

local TabContainer = Instance.new("Frame")
TabContainer.Parent = MainFrame
TabContainer.BackgroundTransparency = 1
TabContainer.Position = UDim2.new(0.02, 0, 0.11, 0)
TabContainer.Size = UDim2.new(0.96, 0, 0.08, 0)

local TabListLayout = Instance.new("UIListLayout")
TabListLayout.Parent = TabContainer
TabListLayout.FillDirection = Enum.FillDirection.Horizontal
TabListLayout.SortOrder = Enum.SortOrder.LayoutOrder
TabListLayout.Padding = UDim.new(0, 6)

local PagesContainer = Instance.new("Folder")
PagesContainer.Name = "PagesContainer"
PagesContainer.Parent = MainFrame

local tabs = {"Farm", "Stats", "Combat", "ESP", "Teleport", "Misc"}
local pageFrames = {}

for i, tabName in ipairs(tabs) do
    local tabBtn = Instance.new("TextButton")
    tabBtn.Parent = TabContainer
    tabBtn.BackgroundColor3 = i == 1 and Color3.fromRGB(45, 45, 70) or Color3.fromRGB(22, 22, 35)
    tabBtn.Size = UDim2.new(0.16, -5, 1, 0)
    tabBtn.Font = Enum.Font.GothamBold
    tabBtn.Text = tabName
    tabBtn.TextColor3 = i == 1 and Color3.fromRGB(255, 255, 255) or Color3.fromRGB(150, 150, 170)
    tabBtn.TextSize = 13
    
    local tabCorner = Instance.new("UICorner")
    tabCorner.CornerRadius = UDim.new(0, 6)
    tabCorner.Parent = tabBtn

    local page = Instance.new("ScrollingFrame")
    page.Name = tabName .. "Page"
    page.Parent = PagesContainer
    page.BackgroundTransparency = 1
    page.Position = UDim2.new(0.02, 0, 0.21, 0)
    page.Size = UDim2.new(0.96, 0, 0.76, 0)
    page.CanvasSize = UDim2.new(0, 0, 2.8, 0)
    page.ScrollBarThickness = 4
    page.ScrollBarImageColor3 = Color3.fromRGB(255, 215, 0)
    page.Visible = (i == 1)

    local pageLayout = Instance.new("UIListLayout")
    pageLayout.Parent = page
    pageLayout.SortOrder = Enum.SortOrder.LayoutOrder
    pageLayout.Padding = UDim.new(0, 8)

    pageFrames[tabName] = page

    tabBtn.MouseButton1Click:Connect(function()
        for _, p in pairs(pageFrames) do p.Visible = false end
        for _, b in pairs(TabContainer:GetChildren()) do
            if b:IsA("TextButton") then
                b.BackgroundColor3 = Color3.fromRGB(22, 22, 35)
                b.TextColor3 = Color3.fromRGB(150, 150, 170)
            end
        end
        page.Visible = true
        tabBtn.BackgroundColor3 = Color3.fromRGB(45, 45, 70)
        tabBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
    end)
end

local menuOpened = false
ToggleButton.MouseButton1Click:Connect(function()
    menuOpened = not menuOpened
    local tweenInfo = TweenInfo.new(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
    if menuOpened then
        MainFrame.Size = UDim2.new(0, 0, 0, 0)
        MainFrame.Visible = true
        TweenService:Create(MainFrame, tweenInfo, {Size = UDim2.new(0, 580, 0, 480)}):Play()
    else
        local tween = TweenService:Create(MainFrame, tweenInfo, {Size = UDim2.new(0, 0, 0, 0)})
        tween:Play()
        tween.Completed:Connect(function()
            if not menuOpened then MainFrame.Visible = false end
        end)
    end
end)

local function AddToggle(pageName, name, configKey)
    local page = pageFrames[pageName]
    if not page then return end

    local btn = Instance.new("TextButton")
    btn.Parent = page
    btn.BackgroundColor3 = Color3.fromRGB(22, 22, 35)
    btn.Size = UDim2.new(1, 0, 0, 42)
    btn.Font = Enum.Font.GothamSemibold
    btn.Text = "  " .. name .. ": OFF"
    btn.TextColor3 = Color3.fromRGB(180, 180, 180)
    btn.TextSize = 13
    btn.TextXAlignment = Enum.TextXAlignment.Left

    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 6)
    corner.Parent = btn

    local indicator = Instance.new("Frame")
    indicator.Parent = btn
    indicator.BackgroundColor3 = Color3.fromRGB(231, 76, 60)
    indicator.Position = UDim2.new(0.92, 0, 0.3, 0)
    indicator.Size = UDim2.new(0, 16, 0, 16)

    local indCorner = Instance.new("UICorner")
    indCorner.CornerRadius = UDim.new(1, 0)
    indCorner.Parent = indicator

    btn.MouseButton1Click:Connect(function()
        ThucConfig[configKey] = not ThucConfig[configKey]
        if ThucConfig[configKey] then
            btn.Text = "  " .. name .. ": ON"
            btn.TextColor3 = Color3.fromRGB(255, 255, 255)
            btn.BackgroundColor3 = Color3.fromRGB(30, 40, 55)
            indicator.BackgroundColor3 = Color3.fromRGB(46, 204, 113)
        else
            btn.Text = "  " .. name .. ": OFF"
            btn.TextColor3 = Color3.fromRGB(180, 180, 180)
            btn.BackgroundColor3 = Color3.fromRGB(22, 22, 35)
            indicator.BackgroundColor3 = Color3.fromRGB(231, 76, 60)
        end
    end)
end

AddToggle("Farm", "Auto Farm Level / Quests", "AutoFarmLevel")
AddToggle("Farm", "Auto Farm Nearest Mobs", "AutoFarmNearest")
AddToggle("Farm", "Auto Farm Boss Spawns", "AutoFarmBoss")
AddToggle("Farm", "Auto Collect Chests / Gold", "AutoChest")
AddToggle("Farm", "Auto Farm Materials (Mảnh vỡ/Đá)", "AutoMaterial")
AddToggle("Farm", "Auto Raids / Dungeon", "AutoRaid")
AddToggle("Farm", "Auto Awakening Skills", "AutoAwakening")

AddToggle("Stats", "Auto Upgrade Melee (Cận chiến)", "AutoStatsMelee")
AddToggle("Stats", "Auto Upgrade Defense (Phòng thủ)", "AutoStatsDefense")
AddToggle("Stats", "Auto Upgrade Sword (Kiếm sĩ)", "AutoStatsSword")
AddToggle("Stats", "Auto Upgrade Gun (Súng)", "AutoStatsGun")
AddToggle("Stats", "Auto Upgrade Devil Fruit (Trái ác quỷ)", "AutoStatsFruit")

AddToggle("Combat", "Aimbot Nearest Target", "Aimbot")
AddToggle("Combat", "Hitbox Expander (Mở rộng đầu địch)", "HitboxExpander")
AddToggle("Combat", "Auto Clicker Fast Attack", "AutoClicker")
AddToggle("Combat", "Auto Busoshoku Haki (Vũ trang)", "AutoHaki")
AddToggle("Combat", "Auto Kenbunshoku Haki (Quan sát)", "AutoKenHaki")
AddToggle("Combat", "Infinite Dash (Lướt không hồi chiêu)", "InfiniteDash")

AddToggle("ESP", "ESP Players (Hiện tên & Khoảng cách)", "ESPPlayer")
AddToggle("ESP", "ESP Devil Fruit (Tìm trái dưới đất)", "ESPFruit")
AddToggle("ESP", "ESP Chests (Rương báu)", "ESPChest")
AddToggle("ESP", "ESP Boss / NPC Quét bản đồ", "ESPBoss")
AddToggle("ESP", "ESP Islands & Ports (Đảo lớn)", "ESPIsland")

AddToggle("Teleport", "NoClip (Đi xuyên tường)", "NoClip")
AddToggle("Teleport", "Fly Mode (Bay lượn tự do)", "FlyMode")
AddToggle("Teleport", "WalkSpeed Boost (Tăng tốc chạy)", "WalkSpeedBoost")
AddToggle("Teleport", "JumpPower Super Jump (Nhảy cao)", "JumpPowerBoost")

AddToggle("Misc", "FullBright (Sáng rực bản đồ đêm)", "FullBright")
AddToggle("Misc", "Remove Fog / Clouds (Xóa sương mù)", "RemoveFog")
AddToggle("Misc", "Auto Bounty Hunter Farm", "AutoBounty")

RunService.Stepped:Connect(function()
    pcall(function()
        local char = LocalPlayer.Character
        local hum = char and char:FindFirstChildOfClass("Humanoid")

        if ThucConfig.NoClip and char then
            for _, part in pairs(char:GetDescendants()) do
                if part:IsA("BasePart") then part.CanCollide = false end
            end
        end

        if ThucConfig.WalkSpeedBoost and hum then
            hum.WalkSpeed = ThucConfig.SpeedVal
        end

        if ThucConfig.JumpPowerBoost and hum then
            hum.JumpPower = ThucConfig.JumpVal
        end

        if ThucConfig.FullBright then
            Lighting.Brightness = 2
            Lighting.ClockTime = 14
            Lighting.GlobalShadows = false
        end

        if ThucConfig.RemoveFog then
            for _, v in pairs(Lighting:GetChildren()) do
                if v:IsA("Atmosphere") or v:IsA("Clouds") or v:IsA("PostEffect") then
                    v:Destroy()
                end
            end
        end

        if ThucConfig.HitboxExpander then
            for _, p in pairs(Players:GetPlayers()) do
                if p ~= LocalPlayer and p.Character and p.Character:FindFirstChild("HumanoidRootPart") then
                    p.Character.HumanoidRootPart.Size = Vector3.new(ThucConfig.HitboxSize, ThucConfig.HitboxSize, ThucConfig.HitboxSize)
                    p.Character.HumanoidRootPart.Transparency = 0.7
                    p.Character.HumanoidRootPart.CanCollide = false
                end
            end
        end
    end)
end)