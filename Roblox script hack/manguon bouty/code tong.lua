for _, gui in ipairs(game:GetService("CoreGui"):GetChildren()) do
    if gui.Name == "ThucHub_BountyMaster" then gui:Destroy() end
end

local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")
local TeleportService = game:GetService("TeleportService")
local HttpService = game:GetService("HttpService")
local StarterGui = game:GetService("StarterGui")

local Config = {
    Team = "Pirates",
    AutoBounty = true,
    TargetingDist = 150,
    AntiBan = true
}

if Config.AntiBan then
    pcall(function()
        local mt = getrawmetatable(game)
        setreadonly(mt, false)
        local oldNamecall = mt.__namecall
        mt.__namecall = newcclosure(function(self, ...)
            local method = getnamecallmethod()
            local args = {...}
            if method == "FireServer" and tostring(self):lower():find("ban") then
                return nil
            end
            return oldNamecall(self, unpack(args))
        end)
        setreadonly(mt, true)
    end)
end

local ScreenGui = Instance.new("ScreenGui")
ScreenGui.Name = "ThucHub_BountyMaster"
ScreenGui.Parent = game:GetService("CoreGui")
ScreenGui.ResetOnSpawn = false

local ToggleButton = Instance.new("ImageButton")
ToggleButton.Parent = ScreenGui
ToggleButton.BackgroundColor3 = Color3.fromRGB(20, 20, 25)
ToggleButton.Position = UDim2.new(0, 30, 0, 150)
ToggleButton.Size = UDim2.new(0, 60, 0, 60)
ToggleButton.Image = "rbxassetid://18497678550"
ToggleButton.Active = true
ToggleButton.Draggable = true

local ToggleCorner = Instance.new("UICorner")
ToggleCorner.CornerRadius = UDim.new(1, 0)
ToggleCorner.Parent = ToggleButton

local ToggleStroke = Instance.new("UIStroke")
ToggleStroke.Color = Color3.fromRGB(0, 170, 255)
ToggleStroke.Thickness = 2
ToggleStroke.Parent = ToggleButton

local MainFrame = Instance.new("Frame")
MainFrame.Parent = ScreenGui
MainFrame.BackgroundColor3 = Color3.fromRGB(15, 15, 20)
MainFrame.Position = UDim2.new(0.5, -275, 0.5, -175)
MainFrame.Size = UDim2.new(0, 550, 0, 350)
MainFrame.Active = true
MainFrame.Draggable = true
MainFrame.Visible = true

local MainCorner = Instance.new("UICorner")
MainCorner.CornerRadius = UDim.new(0, 10)
MainCorner.Parent = MainFrame

local MainStroke = Instance.new("UIStroke")
MainStroke.Color = Color3.fromRGB(0, 170, 255)
MainStroke.Thickness = 2
MainStroke.Parent = MainFrame

ToggleButton.MouseButton1Click:Connect(function()
    MainFrame.Visible = not MainFrame.Visible
end)

local TitleLabel = Instance.new("TextLabel")
TitleLabel.Parent = MainFrame
TitleLabel.BackgroundColor3 = Color3.fromRGB(25, 25, 35)
TitleLabel.Size = UDim2.new(1, 0, 0, 40)
TitleLabel.Font = Enum.Font.GothamBold
TitleLabel.Text = "  THUC HUB | DARK KNIGHT BOUNTY (FIXED 773)"
TitleLabel.TextColor3 = Color3.fromRGB(0, 255, 200)
TitleLabel.TextSize = 14
TitleLabel.TextXAlignment = Enum.TextXAlignment.Left

local TitleCorner = Instance.new("UICorner")
TitleCorner.CornerRadius = UDim.new(0, 10)
TitleCorner.Parent = TitleLabel

local ContentArea = Instance.new("Frame")
ContentArea.Parent = MainFrame
ContentArea.BackgroundColor3 = Color3.fromRGB(22, 22, 30)
ContentArea.Position = UDim2.new(0, 20, 0, 60)
ContentArea.Size = UDim2.new(0, 510, 0, 270)

local ContentCorner = Instance.new("UICorner")
ContentCorner.CornerRadius = UDim.new(0, 8)
ContentCorner.Parent = ContentArea

local StatusLabel = Instance.new("TextLabel")
StatusLabel.Parent = ContentArea
StatusLabel.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
StatusLabel.Position = UDim2.new(0, 15, 0, 15)
StatusLabel.Size = UDim2.new(0, 480, 0, 80)
StatusLabel.Font = Enum.Font.Gotham
StatusLabel.Text = "Status: Scanning safe servers (Bypassing Error 773)...\nCombo: Godhuman -> Portal -> Sword\nAnti-Ban: Active"
StatusLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
StatusLabel.TextSize = 12
StatusLabel.TextXAlignment = Enum.TextXAlignment.Left

local statusCorner = Instance.new("UICorner")
statusCorner.CornerRadius = UDim.new(0, 6)
statusCorner.Parent = StatusLabel

local function getNearestTarget()
    local nearest = nil
    local shortestDist = Config.TargetingDist
    for _, player in ipairs(Players:GetPlayers()) do
        if player ~= LocalPlayer and player.Character and player.Character:FindFirstChild("HumanoidRootPart") then
            local humanoid = player.Character:FindFirstChild("Humanoid")
            if humanoid and humanoid.Health > 0 then
                local dist = (LocalPlayer.Character.HumanoidRootPart.Position - player.Character.HumanoidRootPart.Position).Magnitude
                if dist < shortestDist then
                    shortestDist = dist
                    nearest = player
                end
            end
        end
    end
    return nearest
end

task.spawn(function()
    while true do
        task.wait(1)
        if Config.AutoBounty and LocalPlayer.Character and LocalPlayer.Character:FindFirstChild("HumanoidRootPart") then
            local target = getNearestTarget()
            if target and target.Character and target.Character:FindFirstChild("HumanoidRootPart") then
                local hrp = LocalPlayer.Character.HumanoidRootPart
                local targetHrp = target.Character.HumanoidRootPart
                
                local tweenInfo = TweenInfo.new(0.3, Enum.EasingStyle.Linear)
                local tween = TweenService:Create(hrp, tweenInfo, {CFrame = targetHrp.CFrame * CFrame.new(0, 0, 5)})
                tween:Play()
                
                pcall(function()
                    local vim = game:GetService("VirtualInputManager")
                    vim:SendKeyEvent(true, Enum.KeyCode.Z, false, game); task.wait(0.05); vim:SendKeyEvent(false, Enum.KeyCode.Z, false, game)
                    task.wait(0.2)
                    vim:SendKeyEvent(true, Enum.KeyCode.X, false, game); task.wait(0.05); vim:SendKeyEvent(false, Enum.KeyCode.X, false, game)
                    task.wait(0.2)
                    vim:SendKeyEvent(true, Enum.KeyCode.C, false, game); task.wait(0.05); vim:SendKeyEvent(false, Enum.KeyCode.C, false, game)
                end)
            else
                -- Đợi 5 giây trước khi tìm server mới để tránh spam gây lỗi 773
                task.wait(5)
                pcall(function()
                    local success, response = pcall(function()
                        return game:HttpGet("https://games.roblox.com/v1/games/"..game.PlaceId.."/servers/Public?sortOrder=Asc&limit=100")
                    end)
                    if success and response then
                        local Servers = HttpService:JSONDecode(response)
                        for _, s in ipairs(Servers.data) do
                            if s.playing < s.maxPlayers and s.id ~= game.JobId then
                                StatusLabel.Text = "Status: Switching Server safely (Bypassing 773)..."
                                TeleportService:TeleportToPlaceInstance(game.PlaceId, s.id, LocalPlayer)
                                task.wait(5)
                                break
                            end
                        end
                    end
                end)
            end
        end
    end
end)